import * as getPixels from "image-pixels";
import * as fs from "fs";
import * as fsExtra from "fs-extra";

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import * as prompt from 'prompt';
import * as draftlog from 'draftlog';

import * as playSound from 'play-sound';

draftlog.into(console).addLineListener(process.stdin);

type PixelData = { data: Uint8Array, width: number, height: number; };

interface Canvas
{
	index: number;
	frames: string[];
	finished: boolean;
}

interface Config
{
	ffmpegPath: string;
	mplayerPath: string;
}

//#region Load config

let config: Config =
{
	ffmpegPath: "",
	mplayerPath: ""
};

if(fs.existsSync("./config.json"))
{
	config = JSON.parse(fs.readFileSync("./config.json", { encoding: "ascii" }));
}

//If empty, assume it's in the PATH
if(config.ffmpegPath === "") config.ffmpegPath = "ffmpeg";
else
{
	if(!fs.existsSync(config.ffmpegPath))
	{
		console.log("Error: Path to ffmpeg doesn't exists!"); //Note this doesn't give confirmation that the path is right
		process.exit(1);
	}
}

if(config.mplayerPath === "") config.mplayerPath = "mplayer";
else
{
	if(!fs.existsSync(config.mplayerPath))
	{
		console.log("Error: Path to mplayer doesn't exists!");
		process.exit(1);
	}
}

const audioPlayer = playSound(
	{
		player: config.mplayerPath
	}
);

//#endregion

async function sleep(time: number)
{
	return new Promise(resolve => setTimeout(resolve, time));
}

async function extractFrames(canvas: Canvas, ffmpegProcess: ChildProcessWithoutNullStreams)
{
	let shading = " .:-=+*#%@".split("");
	
	for(let i = 0; i < 10; i++) //Process ten frames at a time
	{
		let imagePath = `${__dirname}/ResizedFrames/out-${canvas.index + 1}.png`;
		
		while(!fs.existsSync(imagePath))
		{
			if(ffmpegProcess.killed) //If reached the end of video and file doesn't exists
			{
				canvas.finished = true;
				return;
			}
			
			await sleep(500); //Else wait for ffmpeg to catch up
		}
		
		let pixelData: PixelData = await getPixels(imagePath);
		canvas.index++;
		
		let str = "";

		for(let j = 0; j < pixelData.data.length; j += 4)
		{
			let value = (.3 * pixelData.data[j] + .59 * pixelData.data[j + 1] + .11 * pixelData.data[j + 2]) / 256 * (pixelData.data[j + 3] / 255); // Get greyscale value then multiply everything by alpha
			
			str += shading[Math.floor(value * shading.length)]; // 0 <= value < 1, so this works
			
			if(Math.floor(j/4) % pixelData.width == pixelData.width-1) str += "\n";
		}

		canvas.frames.push(str);
	}
	
	extractFrames(canvas, ffmpegProcess);
}

prompt.start();

prompt.get(
	[
		{
			name: "videoPath",
			description: "Path to the video file",
			allowEmpty: false,
			pattern: /.+\.((mp4)|(webm)|(mpg)|(mpeg)|(m4v)|(avi)|(mov)|(qt)|(flv)|(ogg)|(wmv)|(mkv))/
		},
		{
			name: "width",
			description: "Video width in characters",
			default: 120,
			allowEmpty: false,
			pattern: /[0-9]+/
		},
		{
			name: "audio",
			description: "Wether audio should be played (y/n)",
			default: "y",
			allowEmpty: false,
			pattern: /[yYnN]/
		}
	],
	(err, result) =>
	{
		//#region Get initial data
		
		if(err) return -1;
		
		const videoPath = result["videoPath"] as string;
		
		if(!fs.existsSync(videoPath))
		{
			console.log("Error: Video doesn't exists!");
			process.exit(1);
		}
		
		const splitPath = videoPath.split(/\/|\\/);
		const video = splitPath[splitPath.length-1];
		
		const videoWidth = result["width"];
		
		const isPlayingAudio = /[yY]/.test(result["audio"] as string);
		
		let ffmpegFps = spawn('ffmpeg', ['-i', videoPath]);
		let fpsString = '';
		let fps = 0;
		
		ffmpegFps.stderr.on('data',
			(data) =>
			{
				fpsString += data;
			}
		);
		
		//#endregion
		
		ffmpegFps.on('close',
			async () =>
			{
				fps = parseInt(fpsString.split("fps")[0].split("kb/s, ")[1]);
				
				fsExtra.emptyDirSync(`${__dirname}/ResizedFrames`);
				
				await new Promise(
					(resolve, reject) =>
					{
						spawn('ffmpeg', ['-i', videoPath, `${__dirname}/ResizedFrames/audio.mp3`]).on('close', resolve);
					}
				);
				
				//Reduce aspect ratio by 2
				let ffmpeg = spawn(config.ffmpegPath, ['-i', videoPath, '-vf', `scale=${videoWidth}:(((${videoWidth}/iw)/2))*ih`, `${__dirname}/ResizedFrames/out-%d.png`]);
				
				process.stdout.write("\u001b[2J\u001b[0;0H"); //Clear terminal
				
				await sleep(1000); //Wait for ffmpeg to warm up
				
				let canvas: Canvas = 
				{
					frames: [],
					index: 0,
					finished: false
				};
				
				extractFrames(canvas, ffmpeg);
				
				
				console.log(`Playing ${video} !`);
				
				await sleep(2000); //Wait for processing to warm up
				
				let currentFrame = console.draft(canvas.frames[0]);
				let newFrame = canvas.frames[0];
				
				// Play audio
				if(isPlayingAudio) audioPlayer.play(`${__dirname}/ResizedFrames/audio.mp3`,
					(err: Error) => 
					{
						process.stdout.write("\u001b[2J\u001b[0;0H");

						process.exit(0);
					}
				);
				
				let index = 0;
				let start = Date.now();
				
				const updateDelay = 1000 / fps;
				
				while(!canvas.finished || index < canvas.index)
				{
					let frameIndex = Math.floor(index)
					
					let frame = canvas.frames[frameIndex];
					
					if(frame == undefined)
					{
						await sleep(updateDelay);
						continue;
					}
					
					canvas.frames[frameIndex] = ""; // Reduce memory usage
					
					currentFrame("\n" + frame);
					
					index = (Date.now() - start) / updateDelay;
				}
			}
		);
	}
);