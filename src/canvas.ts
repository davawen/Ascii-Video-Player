import * as fs from "fs"
import { ChildProcessWithoutNullStreams } from "child_process"

import * as getPixels from "image-pixels";

import { sleep } from "./logic"

type PixelData = { data: Uint8Array, width: number, height: number; };

export class Canvas
{
	private frames: string[];

	index: number;
	frameIndex: number;
	finished: boolean;
	
	charFunction: (r: number, g: number, b: number, a: number) => string;
	
	constructor(charFunction: Canvas["charFunction"])
	{
		this.frameIndex = 0;
		this.index = 0;
		this.frames = [];
		this.finished = false;

		this.charFunction = charFunction;
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
				this.frames[0] += this.charFunction(pixelData.data[j], pixelData.data[j+1], pixelData.data[j+2], pixelData.data[j+3]);

				if(j / 4 % pixelData.width >= pixelData.width - 1) this.frames[0] += "\n";
			}
		}

		while(this.index >= 500) // Don't hold a lot of frames in memory
		{
			await sleep(300);
		}

		this.extractFrames(ffmpegProcess);
	}
}