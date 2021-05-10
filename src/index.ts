import * as getPixels from "image-pixels";
import * as fs from "fs";
import * as fsExtra from "fs-extra";

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import * as prompt from 'prompt';
import * as draftlog from 'draftlog';

import * as playSound from 'play-sound';
const audioPlayer = playSound(
	{
		player: "C:/PATH/mplayer/mplayer.exe"
	}
);

draftlog.into(console).addLineListener(process.stdin);

type PixelData = { data: Uint8Array, width: number, height: number; };

interface Canvas
{
	index: number;
	frames: string[];
	finished: boolean;
}

async function sleep(time: number)
{
	return new Promise(resolve => setTimeout(resolve, time));
}

async function extractFrames(canvas: Canvas, ffmpegProcess: ChildProcessWithoutNullStreams)
{
	let shading = " .'`^ \",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$".split("");
	
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
			// 0.0039 is 1/255
			let value = (.3 * pixelData.data[j] + .59 * pixelData.data[j + 1] + .11 * pixelData.data[j + 2]) * 0.0039 * (pixelData.data[j + 3] * 0.0039); // Get greyscale value then multiply everything by alpha
			
			
			str += shading[ Math.floor(value * (shading.length-1)) ];
			
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
			pattern: /.+\.((mp4)|(webm)|(mpg)|(mpeg)|(m4v)|(avi)|(mov)|(qt)|(flv)|(ogg)|(wmv))/
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
						spawn('ffmpeg', ['-i', videoPath, `${__dirname}/ResizedFrames/$audio.mp3`]).on('close', resolve);
					}
				);
				
				//Reduce aspect ration by 2
				let ffmpeg = spawn('ffmpeg', ['-i', videoPath, '-vf', `scale=${videoWidth}:(((${videoWidth}/iw)/2))*ih`, `${__dirname}/ResizedFrames/out-%d.png`]);
				
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
				
				await sleep(1000); //Wait for processing to warm up
				
				let currentFrame = console.draft(canvas.frames[0]);
				let newFrame = canvas.frames[0];
				
				// Play audio
				if(isPlayingAudio) audioPlayer.play(`${__dirname}/ResizedFrames/$audio.mp3`,
					(err: Error) => 
					{
						process.stdout.write("\u001b[2J\u001b[0;0H")
						
						process.exit(0);
					}
				);
				
				let index = 0;
				let start = Date.now();
				
				const updateDelay = 1000 / fps;
				
				while(!canvas.finished || index < canvas.index)
				{
					let frame = canvas.frames[Math.floor(index)];
					
					if(frame == undefined)
					{
						await sleep(updateDelay);
						continue;
					}
					
					currentFrame(frame);
					
					index = (Date.now() - start) / updateDelay;
				}
			}
		);
	}
);