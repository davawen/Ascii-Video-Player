# Ascii Video Player
This was a project mostly made for fun, and for practicing with spawning command line tools in nodejs.

If for whatever reasons you want to use it, follow these steps :

- Windows:
	- First, you will need to download [ffmpeg](https://www.ffmpeg.org/) and [mplayer](http://www.mplayerhq.hu/design7/projects.html#unofficial_packages) if you don't have them, and place them in your PATH
		- Open the search bar and type "env".
		- Go to `Edit the system environment variables`, then click the `Environment variables` button.
		- Under `System variables`, find `Path`, then click on the `edit` button.
		- Next create two new entries linking to the directory of ffmpeg and mplayer, for exemple, if you had them in your root, you would add: 
			```
			C:/ffmpeg/bin/
			C:/mplayer/
			```
	- Then, you will need to install [nodejs](https://nodejs.org/en/) on your system
		- Once it's installed, open a command prompt and run `npm i -g typescript` to install the typescript compiler.
	- You can then clone or download this repo.
	- Finally, open a command prompt in the project directory and first run `npm i` to install all the dependencies, then `tsc` to compile the project.
	- Everything is now ready, simply type `node .` to launch it.
- Linux:
	- Install ffmpeg, mplayer, nodejs and npm with `apt` or whatever packet manager you're using.
	- Install the typescript compiler with `npm i -g typescript`.
	- Clone or download the repo.
	- Install the dependencies with `npm i` and then run `tsc` to compile it.
	- Simply type `node .` to launch it.