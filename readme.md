# Ascii Video Player
This was a project mostly made for fun, and for practicing with spawning command line tools in nodejs.

If for whatever reasons you want to use it, follow these steps :

(Also please note this is Windows centric, but if you're on a different OS, a bit of googling should show you the relevant way to do it.)

- First, you will need to download [ffmpeg](https://www.ffmpeg.org/) and [mplayer](http://www.mplayerhq.hu/design7/projects.html#unofficial_packages) if you don't have them.
- Then, you will need to install [nodejs](https://nodejs.org/en/) on your system
  - Once it's installed, open a command prompt and run `npm i -g typescript` to install the typescript compiler
  - If you have done it correctly, running `tsc --version` shouldn't give any errors.
- You can then clone or download this repo.
  - Make sure to modify `config.json` to link to your ffmpeg and mplayer executables.\
    For example, if they were in your root, you would do: 
    ```json
    {
	  "ffmpegPath": "C:/ffmpeg/bin/ffmpeg.exe",
	  "mplayerPath": "C:/mplayer/mplayer.exe"
    }	
    ```
- Finally, open a command prompt in the project directory and first run `npm i` to install all the dependencies, then `tsc` to compile the project.
- Everything is now ready, simply type `node .` to launch it, you will be asked a few parameters, and you will then be able to witness some crisp ascii video<sup>tm</sup>.