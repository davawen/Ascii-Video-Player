import * as fs from "fs";
import * as fsExtra from "fs-extra";

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import { Instance as Chalk } from "chalk";
import * as prompt from 'prompt';
import * as DraftLog from 'draftlog';

import * as playSound from 'play-sound';

//#region Set import configs

const chalk = new Chalk({ level: 3 });

(prompt as any).colors = false;
(prompt as any).message = "";

DraftLog.into(console).addLineListener(process.stdin);

const audioPlayer = playSound(
	{
		player: "mplayer"
	}
);

//#endregion

import { sleep } from "./logic"
import { Canvas } from "./canvas"

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
			description: "Wether color should be used (n/char/pixel)",
			default: "n",
			allowEmpty: false,
			pattern: /[nN]|(char)|(pixel)/
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
		
		// pixel -> 2, char -> 1, no/other -> 0
		const colorUsed =
			(/(pixel)/.test(result["color"] as string) ? "pixel" : (/(char)/.test(result["color"] as string) ? "char" : "no"));
		
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
				
				videoWidth = Math.floor(videoWidth);
				videoHeight = Math.floor(videoHeight);
				
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
				
				let canvas: Canvas;
				
				let chars: string[] = [];
				switch(colorUsed)
				{
					default:
					case "no":
						chars = " .',:-~=|({[&#".split("");
					
						canvas = new Canvas(
							(r, g, b, a) =>
							{
								let value = (.3*r + .59*g + .11*b) / 256 * (a / 255); // Get greyscale value then multiply everything by alpha
								
								return chars[Math.floor(value * chars.length)];
							}
						);
						break;
					case "char":
						chars = ["#"];
					case "pixel":
						chars = chars.length == 0 ? ["█"] : chars;
					
						canvas = new Canvas(
							(r, g, b, a) =>
							{
								return chalk.rgb(r, g, b)(chars[0]);
							}
						);
						break;
				}
				
				canvas.extractFrames(ffmpeg);
				
				console.log(`Playing ${video} in ${videoWidth}x${videoHeight * 2} and ${colorUsed} color mode at ${fps} FPS !`);
				
				let frame = console.draft("");
				let startupAnimation = "\n";
				
				let step = Math.floor((videoHeight*videoWidth) / 200);
				
				// Nice animation while processing the first frames
				for(let i = 0; i < videoHeight; i++)
				{
					for(let j = 0; j < videoWidth; j++)
					{
						startupAnimation += chars[chars.length-1];
						frame(startupAnimation);
						
						if(j % step == 0) await sleep(3);
					}
					
					startupAnimation += "\n";
				}
				
				await sleep(1000); //Wait a little bit
				
				// Play audio
				if(isPlayingAudio) audioPlayer.play(`${__dirname}/ResizedFrames/audio.mp3`,
					(err) =>
					{
						if(err)
						{
							console.log(err);
							
							process.exit(1);
						}
						
						return;
					}
				);
				
				let start = Date.now();
				let index = 0;

				const updateDelay = 1000 / fps;
				
				async function playVideo()
				{
					if(canvas.index <= 0 && canvas.finished)
					{
						console.log(`\nFinished playing ${video}!`);
						
						process.exitCode = 0;
						
						return;
					}
					
					index = (Date.now() - start) / updateDelay;
					
					for(let i = 1; i < index; i++)
					{
						let currentFrame = canvas.popFrame();

						if(currentFrame == undefined) await sleep(updateDelay);
						else frame("\n" + currentFrame);
						
						start += updateDelay;
					}
					
					
					setImmediate(playVideo);
				}
				
				playVideo();
			}
		);
	}
);