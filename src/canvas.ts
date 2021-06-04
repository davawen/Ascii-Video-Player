import * as fs from "fs"
import { ChildProcessWithoutNullStreams } from "child_process"

import * as getPixels from "image-pixels";

import { sleep } from "./logic"

type PixelData = { data: Uint8Array, width: number, height: number; };

export class Canvas
{
	private frames: string[];
	
	rawFrames: PixelData[];
	private finishedRawFrames: boolean;
	
	index: number;
	frameIndex: number;
	finished: boolean;
	
	charFunction: (r: number, g: number, b: number, a: number) => string;
	
	constructor(charFunction: Canvas["charFunction"])
	{
		this.frameIndex = 0;
		this.index = 0;
		this.frames = [];
		this.rawFrames = [];
		
		this.finished = false;
		this.finishedRawFrames = false;
		
		this.charFunction = charFunction;
	}

	popFrame(): string
	{
		this.index--;

		return this.frames.pop();
	}
	
	async readFrames(ffmpegProcess: ChildProcessWithoutNullStreams, index: number = 0): Promise<void>
	{
		for(let i = 0; i < 10; i++)
		{
			let imagePath = `${__dirname}/ResizedFrames/out-${index + 1}.png`;
			
			if(!fs.existsSync(imagePath))
			{
				if(ffmpegProcess.killed)
				{
					this.finishedRawFrames = true;
					return;
				}
				
				await sleep(50);
				break;
			}
			
			try
			{
				this.rawFrames.unshift(await getPixels(imagePath));
			}
			catch(e)
			{
				break;
			}
			
			index++;
		}
		
		this.readFrames(ffmpegProcess, index);
	}
	
	async processFrames(): Promise<void>
	{
		for(let i = 9; i >= 0; i--) //Process ten frames at a time
		{
			if(this.rawFrames.length === 0 && this.finishedRawFrames)
			{
				this.finished = true;
				return;
			}
			
			this.frames.unshift("");
			
			const pixelData = this.rawFrames.pop();
			
			if(pixelData === undefined)
			{
				await sleep(30);
				continue;
			}
			
			this.index++;
			this.frameIndex++;

			for(let j = 0; j < pixelData.data.length; j += 4)
			{
				this.frames[0] += this.charFunction(pixelData.data[j], pixelData.data[j+1], pixelData.data[j+2], pixelData.data[j+3]);

				if(j / 4 % pixelData.width >= pixelData.width - 1) this.frames[0] += "\n";
			}
		}

		while(this.index >= 700) // Don't hold a lot of frames in memory
		{
			await sleep(200);
		}

		this.processFrames();
	}
}