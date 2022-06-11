# Ascii Video Player
This was a project mostly made for fun, and for practicing with spawning command line tools in nodejs.

## Dependencies

- `nodejs`
	- `typescript`
- `ffmpeg`
- `mplayer`

## Build Instructions

- Windows:
	- First, make sure you have [ffmpeg](https://www.ffmpeg.org/) and [mplayer](http://www.mplayerhq.hu/design7/projects.html#unofficial_packages) installed and in your PATH
	- Clone or download this repo.
	- Open a command prompt in the project directory and first run `npm i` to install all the dependencies, then `tsc` to compile the project.
	- Simply type `node .` to launch it.
- Linux:
	- Install ffmpeg, mplayer, nodejs and npm with your given package manager.
	- Make sure you have typescript installed.
	- Clone or download the repo.
	- Install the dependencies with `npm i` and then run `tsc` to compile it.
	- Simply type `node .` to launch it.
