import * as fs from "fs";
import * as fsExtra from "fs-extra";

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

import * as prompt from 'prompt';

import * as playSound from 'play-sound';

//#region Set import configs

(prompt as any).colors = false;
(prompt as any).message = "";

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
				
				process.stdout.write("\u001b[2J\u001b[1;1H"); //Clear terminal
				
				let canvas: Canvas;
				
				let chars: string[] = [];
				switch(colorUsed)
				{
					default:
					case "no":
						// `:~/{E#M&&@
						// .',:-~=|({[&#
						
						chars = " .',:-~=|({[&#@".split("");
						
						canvas = new Canvas(
							(r, g, b, a) =>
							{
								let value = (.3*r + .59*g + .11*b) / 256 * (a / 255); // Get greyscale value then multiply everything by alpha
								
								return chars[Math.floor(value * chars.length)];
							}
						);
						break;
					case "char":
						chars = " .',:-~=|({[&#@".split("");
						
						canvas = new Canvas(
							(r, g, b) =>
							{
								let value = (.3 * r + .59 * g + .11 * b) / 256;
								
								r /= 255;
								g /= 255;
								b /= 255;

								let max = Math.max(r, g, b), min = Math.min(r, g, b);
								let h, s;

								let d = max - min;
								s = max == 0 ? 0 : d / max;

								if(max == min)
								{
									h = 0; // achromatic
								}
								else
								{
									switch(max)
									{
										case r: h = (g - b) / d + (g < b ? 6 : 0); break;
										case g: h = (b - r) / d + 2; break;
										case b: h = (r - g) / d + 4; break;
									}
								}
								
								let i = Math.floor(h);
								let f = h - i;
								let p = 1 * (1 - s);
								let q = 1 * (1 - f * s);
								let t = 1 * (1 - (1 - f) * s);
								
								switch(i)
								{
									case 0: r = 1, g = t, b = p; break;
									case 1: r = q, g = 1, b = p; break;
									case 2: r = p, g = 1, b = t; break;
									case 3: r = p, g = q, b = 1; break;
									case 4: r = t, g = p, b = 1; break;
									case 5: r = 1, g = p, b = q; break;
								}
								
								r = Math.floor(r * 255);
								g = Math.floor(g * 255);
								b = Math.floor(b * 255);
								
								return `\u001b[38;2;${r};${g};${b}m${chars[Math.floor(value * chars.length)]}`;
							}
						)
						break;
					case "pixel":
						chars = ["█"];
					
						canvas = new Canvas(
							(r, g, b) =>
							{
								return `\u001b[38;2;${r};${g};${b}m${chars[0]}`;
							}
						);
						break;
				}
				
				await sleep(500); //Wait for ffmpeg to warm up
				
				canvas.readFrames(ffmpeg);
				
				console.log(`Playing ${video} in ${videoWidth}x${videoHeight * 2} at ${fps} FPS !`);
				
				await sleep(2500); // Wait for disk reading to warm up
				
				canvas.processFrames(); //Start processing frames
				
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
						process.stdout.write(`\u001b[1000B\nFinished playing ${video}!`);
						
						process.exitCode = 0;
						
						return;
					}
					
					index = (Date.now() - start) / updateDelay;
					
					for(let i = 1; i < index; i++)
					{
						let currentFrame = canvas.popFrame();
						
						if(i >= index - 1 && currentFrame != undefined) process.stdout.write(`\u001b[3;1H${currentFrame}`);
						
						start += updateDelay;
					}
					
					
					setImmediate(playVideo);
				}
				
				playVideo();
			}
		);
	}
);