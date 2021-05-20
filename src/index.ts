import * as getPixels from "image-pixels";
import * as fs from "fs";
import * as fsExtra from "fs-extra";

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import * as prompt from 'prompt';
import * as DraftLog from 'draftlog';
import { Instance as Chalk } from "chalk";

import * as playSound from 'play-sound';

//#region Set import configs
const chalk = new Chalk( { level: 3 } );

(prompt as any).colors = false;
(prompt as any).message = "";

DraftLog.into(console).addLineListener(process.stdin);

//#endregion

type PixelData = { data: Uint8Array, width: number, height: number; };
let shading = " .:-=+*#%@".split("");

class Canvas
{
	private frames: string[];

	index: number;
	frameIndex: number;
	finished: boolean;
	
	constructor()
	{
		this.frameIndex = 0;
		this.index = 0;
		this.frames = [];
		this.finished = false;
	}
	
	popFrame(): string
	{
		this.index--;
		
		return this.frames.pop();
	}
	
	async extractFrames(ffmpegProcess: ChildProcessWithoutNullStreams): Promise<void>
	{
		for(let i = 9; i >= 0; i--) //Process ten frames at a time
		{
			this.frames.unshift("");
			
			let imagePath = `${__dirname}/ResizedFrames/out-${this.frameIndex + 1}.png`;

			while(!fs.existsSync(imagePath))
			{
				if(ffmpegProcess.killed) //If reached the end of video and file doesn't exists
				{
					this.finished = true;
					return;
				}

				await sleep(500); //Else wait for ffmpeg to catch up
			}

			let pixelData: PixelData = await getPixels(imagePath);

			this.index++;
			this.frameIndex++;

			for(let j = 0; j < pixelData.data.length; j += 4)
			{
				let value = (.3 * pixelData.data[j] + .59 * pixelData.data[j + 1] + .11 * pixelData.data[j + 2]) / 256 * (pixelData.data[j + 3] / 255); // Get greyscale value then multiply everything by alpha
				
				this.frames[0] += shading[Math.floor(value * value * shading.length)];
				
				if(j/4 % pixelData.width >= pixelData.width - 1) this.frames[0] += "\n";
			}
		}
		
		while(this.index >= 500) // Don't hold a lot of frames in memory
		{
			await sleep(300);
		}
		
		this.extractFrames(ffmpegProcess);
	}
	
	async extractFramesColor(ffmpegProcess: ChildProcessWithoutNullStreams): Promise<void>
	{
		for(let i = 9; i >= 0; i--) //Process ten frames at a time
		{
			this.frames.unshift("");
			
			let imagePath = `${__dirname}/ResizedFrames/out-${this.frameIndex + 1}.png`;

			while(!fs.existsSync(imagePath))
			{
				if(ffmpegProcess.killed) //If reached the end of video and file doesn't exists
				{
					this.finished = true;
					return;
				}

				await sleep(500); //Else wait for ffmpeg to catch up
			}

			let pixelData: PixelData = await getPixels(imagePath);

			this.index++;
			this.frameIndex++;

			for(let j = 0; j < pixelData.data.length; j += 4)
			{
				this.frames[0] += chalk.rgb(pixelData.data[j], pixelData.data[j + 1], pixelData.data[j + 2])("█"); // █

				if(j/4 % pixelData.width >= pixelData.width - 1) this.frames[0] += "\n";
			}
		}

		while(this.index >= 500) // Don't hold a lot of frames in memory
		{
			await sleep(500);
		}

		this.extractFramesColor(ffmpegProcess);
	}
}

const audioPlayer = playSound(
	{
		player: "mplayer"
	}
);

async function sleep(time: number)
{
	return new Promise(resolve => setTimeout(resolve, time));
}

prompt.start();

prompt.get(
	[
		{
			name: "videoPath",
			description: "Path to the video file",
			allowEmpty: false,
			conform: (value) => fs.existsSync(value),
			message: "Path must exist."
		},
		{
			name: "color",
			description: "Wether color should be used (y/n) (Not recommended with a large width)",
			default: "n",
			allowEmpty: false,
			pattern: /[yYnN]/
		},
		{
			name: "audio",
			description: "Wether audio should be played (y/n)",
			default: "y",
			allowEmpty: false,
			pattern: /[yYnN]/
		},
		{
			name: "width",
			description: "Video width in characters (Fractional amount will scale based on terminal size)",
			default: 120,
			allowEmpty: false,
			pattern: /[0-9]+/
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
		
		let videoWidth = parseFloat(result["width"] as string);
		
		const isPlayingAudio = /[yY]/.test(result["audio"] as string);
		const isUsingColor = /[yY]/.test(result["color"] as string);
		
		let ffmpegMetadata = spawn('ffmpeg', ['-i', videoPath]);
		let videoMetadata = '';
		let fps = 0;
		let width = 0;
		let height = 0;
		
		ffmpegMetadata.stderr.on('data',
			(data) =>
			{
				videoMetadata += data;
			}
		);
		
		//#endregion
		
		ffmpegMetadata.on('close',
			async () =>
			{
				if(videoMetadata.includes("Invalid data found when processing input"))
				{
					console.log("Input file is not a valid file format.");
					process.exit(1);
				}
				
				fps = parseFloat(videoMetadata.match(/[0-9\.]+ fps/)[0]);
				
				//Search for 1920x1080 but omit 0x181254 for exemple
				let size = videoMetadata.match(/(?:(?!0{1})[0-9]+)x[0-9]+/g)[0].split("x");
				width = parseFloat(size[0]);
				height = parseFloat(size[1])/2;
				
				if(videoWidth <= 1) //Fractional unit
				{
					videoWidth = Math.floor(process.stdout.columns * videoWidth);
				}
				
				let videoHeight = videoWidth / (width/height);

				
				// Resize if too big for console
				if(videoHeight > process.stdout.rows - 4)
				{
					videoHeight = process.stdout.rows - 4;
					
					videoWidth = videoWidth / ((videoWidth / videoHeight) / (width / height))
				}
				
				if(videoWidth > process.stdout.columns)
				{
					videoWidth = process.stdout.columns;
					
					videoHeight = videoHeight * ((videoWidth / videoHeight) / (width / height))
				}
				
				fsExtra.emptyDirSync(`${__dirname}/ResizedFrames`);
				
				await new Promise(
					(resolve, reject) =>
					{
						spawn('ffmpeg', ['-i', videoPath, `${__dirname}/ResizedFrames/audio.mp3`]).on('close', resolve);
					}
				);
				
				//Reduce aspect ratio by 2
				let ffmpeg = spawn("ffmpeg", ['-i', videoPath, '-vf', `scale=${videoWidth}:${videoHeight}`, `${__dirname}/ResizedFrames/out-%d.png`]);
				
				process.stdout.write("\u001b[2J\u001b[0;0H"); //Clear terminal
				
				await sleep(1000); //Wait for ffmpeg to warm up
				
				let canvas: Canvas = new Canvas();
				
				if(isUsingColor) canvas.extractFramesColor(ffmpeg);
				else canvas.extractFrames(ffmpeg);
				
				let firstFrame: PixelData = await getPixels(`${__dirname}/ResizedFrames/out-1.png`);

				console.log(`Playing ${video} in ${firstFrame.width}x${firstFrame.height * 2} at ${fps} FPS !`);
				
				await sleep(2000); //Wait for processing to warm up
				
				let frame = console.draft(canvas.popFrame());
				
				// Play audio
				if(isPlayingAudio) audioPlayer.play(`${__dirname}/ResizedFrames/audio.mp3`,
					(err) =>
					{
						if(err)
						{
							console.log(err);
							
							process.exit(1);
						}
					}
				);
				
				let index = 0;
				let lastUpdate = Date.now();
				
				const updateDelay = 1000 / fps;
				
				while(true)
				{
					if(canvas.index <= 0 && canvas.finished)
					{
						console.log(`\nFinished playing ${video}!`);

						process.exit(0);
					}
					
					if(Date.now() - lastUpdate < updateDelay)
					{
						await sleep(updateDelay - (Date.now() - lastUpdate));
					}
					
					lastUpdate = Date.now();
					
					let currentFrame = canvas.popFrame();
					
					if(currentFrame != undefined)
					{
						frame("\n" + currentFrame);
					}
				}
			}
		);
	}
);