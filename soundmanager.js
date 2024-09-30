class SoundManager{
    #blasterSound;
    #astExplosion;
    #shipFailureSound;
    #finalShipSound;
    #ambientShipNoise;

    #accelSound;
    #decelSound;


    #accelBuffer;
    #decelBuffer;
    #currentAccelNode;
    #accelGainNode;
    #currentDecelNode;
    #decelGainNode;
    constructor(){
        this.#blasterSound = new Sound("./sounds/blasterCrop.mp3");
        this.#astExplosion = new Sound("./sounds/astExplode.mp3");
        this.#shipFailureSound = new Sound("./sounds/shipFailure.mp3");
        this.#finalShipSound = new Sound("./sounds/finalShipBoom.mp3");

        //this.#ambientShipNoise = new Sound("./sounds/ambientShip.wav");
        this.#ambientShipNoise = new Sound("./sounds/ambientShip1.wav");
        this.#ambientShipNoise.setLoopTrue();

        //this.#accelSound = new Sound("./sounds/accel0.mp3");
        //this.#decelSound = new Sound("./sounds/deccel0.mp3");
        this.#accelSound = new Sound("./sounds/accel1.wav");
        this.#decelSound = new Sound("./sounds/deccel0.wav");

        //EXPERIMENTING WITH WEBAUDIO API FOR SEAMLESS LOOPING
        this.audioContext = new AudioContext();
    }

    resumeAudioContext(){
        this.audioContext.resume().then(() => {
            //looping sound
            this.sourceTrack = this.audioContext.createMediaElementSource(this.#ambientShipNoise.getSoundObj());
            this.sourceTrack.connect(this.audioContext.destination);
            this.sourceTrack.loop = true;

            /*
            //accel sound
            this.accelTrack = this.audioContext.createMediaElementSource(this.#accelSound.getSoundObj());
            this.accelGainNode = this.audioContext.createGain();
            this.accelTrack.connect(this.accelGainNode);
            this.accelGainNode.connect(this.audioContext.destination);

            //decel sound
            this.decelTrack = this.audioContext.createMediaElementSource(this.#decelSound.getSoundObj());
            this.decelGainNode = this.audioContext.createGain();
            this.decelTrack.connect(this.decelGainNode);
            this.decelGainNode.connect(this.audioContext.destination);
            */
           fetch("./sounds/accel1.wav")
           .then(res => res.arrayBuffer())
           .then(buf => this.audioContext.decodeAudioData(buf))
           .then(audioBuf =>{
                this.#accelBuffer = audioBuf;
           });

           fetch("./sounds/deccel0.wav")
           .then(res => res.arrayBuffer())
           .then(buf => this.audioContext.decodeAudioData(buf))
           .then(audioBuf =>{
                this.#decelBuffer = audioBuf;
           });
        })
    }

    startAccelSound(){
        if (this.#accelBuffer != undefined){
            this.#currentAccelNode = this.audioContext.createBufferSource();
            this.#currentAccelNode.buffer = this.#accelBuffer;
            this.#accelGainNode = this.audioContext.createGain();
            this.#currentAccelNode.connect(this.#accelGainNode);
            this.#accelGainNode.connect(this.audioContext.destination);
            this.#currentAccelNode.start();
        }
    }
    stopAccelSound(){
        if (this.#accelBuffer != undefined && this.#accelGainNode != undefined && this.#currentAccelNode != undefined){
            this.#accelGainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            this.#currentAccelNode.stop(this.audioContext.currentTime + 0.21);
        }
    }

    startDecelSound(){
        if (this.#decelBuffer != undefined){
            this.#currentDecelNode = this.audioContext.createBufferSource();
            this.#currentDecelNode.buffer = this.#decelBuffer;
            this.#decelGainNode = this.audioContext.createGain();
            this.#currentDecelNode.connect(this.#decelGainNode);
            this.#decelGainNode.connect(this.audioContext.destination);
            this.#currentDecelNode.start();
        }
    }
    stopDecelSound(){
        if (this.#decelBuffer != undefined && this.#decelGainNode != undefined && this.#currentDecelNode != undefined){
            this.#decelGainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            this.#currentDecelNode.stop(this.audioContext.currentTime + 0.21);
        }
    }

    /*
    playAccelSound(){
        if (!this.#accelSound.isPlaying()){
            if (this.#decelSound.isPlaying()){
                //this.#decelSound.pauseAndReset();
                this.#decelSound.stopSound();
            }
            this.#accelSound.play();
        }
    }
    stopAccelSound(){
        //this.#accelSound.pauseAndReset();
        this.#accelSound.stopSound();
    }
    playDecelSound(){
        if (!this.#decelSound.isPlaying()){
            if (this.#accelSound.isPlaying()){
                //this.#accelSound.pauseAndReset();
                this.#accelSound.stopSound();
            }
            this.#decelSound.play();
        }
    }
    stopDecelSound(){
        //this.#decelSound.pauseAndReset();
        this.#decelSound.stopSound();
    }
    */
    playBlasterFire(){this.#blasterSound.play();}
    playFinalShipExplosion(){
        if(this.#shipFailureSound.isPlaying()){
            this.#shipFailureSound.pauseAndReset();
            //this.#shipFailureSound.stopSound();
        }
        if (this.#astExplosion.isPlaying()){
            //this.#astExplosion.pauseAndReset();
            this.#astExplosion.stopSound();
        }
        this.#finalShipSound.setVolume(0.7);
        this.#finalShipSound.play();
    }
    playShipFailureSound(){
        this.#shipFailureSound.setVolume(0.7);
        this.#shipFailureSound.play();
    }
    playAstExplosion(distance){
        //need to map the distance to 0 (softest) and 1 (loudest)
        const maxFalloffDist = 30.0;
        const softestSound = 0.1;
        let volume = ((softestSound - 1)/maxFalloffDist) * distance + 1;//linear function
        if (volume < softestSound) volume = softestSound;
        
        this.#astExplosion.setVolume(volume);
        this.#astExplosion.play();
    }

    playAmbientEngine(){
        this.#ambientShipNoise.play();
    }
    stopAmbientEngine(){
        //this.#ambientShipNoise.stopSound();
        this.#ambientShipNoise.pauseAndReset();
    }
}


class Sound{
    #sound;
    #fadeInProg = false;
    #intervalID;
    constructor(source){
        this.#sound = new Audio(source);
        this.#sound.setAttribute("preload", "auto");
    }
    setLoopTrue(){this.#sound.loop = true;}

    isFading(){return this.#fadeInProg;}
    setFadeInProg(bool){this.#fadeInProg = bool;}
    getSoundObj(){return this.#sound;}


    //vol must be between 0 (muted) and 1 (loudest possible)
    setVolume(vol){
        this.#sound.volume = vol;
    }
    getVolume(){return this.#sound.volume;}

    //isPlaying(){return (!this.#sound.ended);}
    isPlaying(){return (this.#sound.duration > 0 && !this.#sound.paused);}
    pauseAndReset(){
        this.#sound.pause();
        this.#sound.currentTime = 0;
    }

    stopSound(){
        if (this.isPlaying()){
            this.#intervalID = setTimeout(()=>this.#fadeAudio(), 50);
            //this.#intervalID = setInterval(()=>this.#fadeAudio(), 50);
        }
    }

    play(){//if sound is already playing, simply pause it, and restart it
        if (this.isPlaying() && !this.#sound.loop){
        //if (!this.#sound.ended){
            
            
            this.#sound.pause();
            this.#sound.currentTime = 0;
            this.#sound.play();
            
            //this.#intervalID = setTimeout(()=>this.#fadeAudio(true), 50);
            //this.#intervalID = setInterval(()=>this.#fadeAudio(true), 50);

        }
        else{
            //this.#sound.volume = volume;
            this.#sound.play();
        }
    }

    #fadeAudio(replay=false){
        if (this.isPlaying()){
            const oldVol = this.#sound.volume;
            const newVol = oldVol - 0.1;
            if (newVol > 0){
                this.#sound.volume = newVol;
            }
            else{
                this.pauseAndReset();
                this.#sound.volume = 1.0;
                this.#fadeInProg = false;
                if(replay){
                    this.#sound.play();
                }
                clearInterval(this.#intervalID);
            }
        }
        else{
            this.pauseAndReset();
            this.#sound.volume = 1.0;
            clearInterval(this.#intervalID);
            if (replay){
                this.#sound.play();
            }
        }
    }
}

export {SoundManager};