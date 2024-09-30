const yawIncrement = 3.0;
const pitchIncrement = 3.0;
const rollIncrement = 3.0;

const localForward = glMatrix.vec3.fromValues(0.0, 0.0, -1.0);
const localUp = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
const localRight = glMatrix.vec3.fromValues(1.0, 0.0, 0.0);

var posroll = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(posroll, localForward, toRadians(rollIncrement)/2);
var negroll = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(negroll, localForward, -1 * toRadians(rollIncrement)/2);

var posyaw = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(posyaw, localUp, toRadians(yawIncrement)/2);
var negyaw = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(negyaw, localUp, -1 * toRadians(yawIncrement)/2);

var pospitch = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(pospitch, localRight, toRadians(pitchIncrement)/2);
var negpitch = glMatrix.quat.create();
glMatrix.quat.setAxisAngle(negpitch, localRight, -1 * toRadians(pitchIncrement)/2);

function toRadians(angle){
    return angle * (Math.PI / 180);
}

/*
class Camera{
    q = glMatrix.quat.create();
    position = glMatrix.vec3.fromValues(0.0, 0.0, 7.0);//7.0 original value


    rotationMatrix = glMatrix.mat4.create();
    updateMat = true;

    moving = false;


    keyPressedState = {
        "a":false,
        "d":false,
        "w":false,
        "s":false,
        "ArrowLeft":false,
        "ArrowRight":false,
    }


    constructor(){
        this.getViewMatrix();

    }
    pressKey(key){
        if (this.keyPressedState.hasOwnProperty(key)){
            this.keyPressedState[key] = true;
        }
        if (key == '1'){
            this.moving = !this.moving;//toggle movement boolean
        }
    }

    releaseKey(key){
        if (this.keyPressedState.hasOwnProperty(key)){
            this.keyPressedState[key] = false;
        }
    }

    updateCamera(deltaTime){
        if (this.keyPressedState["a"]){
            glMatrix.quat.multiply(this.q, this.q, posyaw);
            this.updateMat = true;
        }
        if (this.keyPressedState["d"]){
            glMatrix.quat.multiply(this.q, this.q, negyaw);
            this.updateMat = true;
        }
        if (this.keyPressedState["w"]){
            glMatrix.quat.multiply(this.q, this.q, pospitch);
            this.updateMat = true;
        }
        if (this.keyPressedState["s"]){
            glMatrix.quat.multiply(this.q, this.q, negpitch);
            this.updateMat = true;
        }
        if (this.keyPressedState["ArrowLeft"]){
            glMatrix.quat.multiply(this.q, this.q, negroll);
            this.updateMat = true;
        }
        if (this.keyPressedState["ArrowRight"]){
            glMatrix.quat.multiply(this.q, this.q, posroll);
            this.updateMat = true;
        }
        if (this.moving){
            
            const forwardVec = this.getForwardVec();
            const moveVec = glMatrix.vec3.create();
            glMatrix.vec3.normalize(moveVec, forwardVec);

            const distance = deltaTime * speed;
            glMatrix.vec3.scale(moveVec, moveVec, distance);//was 0.05
            glMatrix.vec3.add(this.position, this.position, moveVec);
            this.updateMat = true;
            
        }
    }

    getViewMatrix(){
        if (this.updateMat){
            this.updateMat = false;
            glMatrix.quat.normalize(this.q, this.q);

            glMatrix.mat4.identity(this.rotationMatrix);
            var conjq = glMatrix.quat.create();
            glMatrix.quat.conjugate(conjq, this.q);
            glMatrix.mat4.fromQuat(this.rotationMatrix, conjq);

            var translationVec = glMatrix.vec3.create();
            glMatrix.vec3.scale(translationVec, this.position, -1);
            glMatrix.mat4.translate(this.rotationMatrix, this.rotationMatrix, translationVec);
        }
        return this.rotationMatrix;
    }

    getPosition(){return this.position;}
    getQuat(){return this.q;}

    getForwardVec(){
        var forward = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(forward, localForward, this.q);
        glMatrix.vec3.normalize(forward, forward);
        return forward;
    }
    getUpVec(){
        var up = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(up, localUp, this.q);
        glMatrix.vec3.normalize(up, up);
        return up;
    }
    getRightVec(){
        var right = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(right, localRight, this.q);
        glMatrix.vec3.normalize(right, right);
        return right;
    }
    
}
*/


class Camera{
    #q;
    #position;
    #rotationMatrix;
    #updateMat;
    constructor(pos){
        this.#q = glMatrix.quat.create();
        this.#position = glMatrix.vec3.clone(pos);
        this.#rotationMatrix = glMatrix.mat4.create();
        this.#updateMat = true;
        this.getViewMatrix();
    }

    adjustOrientation(childQuat){//Rotation relative to objects current local axes
        glMatrix.quat.multiply(this.#q, this.#q, childQuat);
        this.#updateMat = true;
    }
    adjustGlobalOrientation(rotQuat){//Rotation relative to the global, world axes
        glMatrix.quat.multiply(this.#q, rotQuat, this.#q);
        this.#updateMat = true;
    }

    adjustPosition(addVector){
        glMatrix.vec3.add(this.#position, this.#position, addVector);
        this.#updateMat = true;
    }

    //setters
    setPosition(pos){
        glMatrix.vec3.copy(this.#position, pos);
        this.#updateMat = true;
    }
    setQuat(quat){
        glMatrix.quat.copy(this.#q, quat);
        this.#updateMat = true;
    }

    //Parent Camera Class Getters
    getViewMatrix(){
        if (this.#updateMat){
            this.#updateMat = false;
            glMatrix.quat.normalize(this.#q, this.#q);

            glMatrix.mat4.identity(this.#rotationMatrix);
            var conjq = glMatrix.quat.create();
            glMatrix.quat.conjugate(conjq, this.#q);
            glMatrix.mat4.fromQuat(this.#rotationMatrix, conjq);

            var translationVec = glMatrix.vec3.create();
            glMatrix.vec3.scale(translationVec, this.#position, -1);
            glMatrix.mat4.translate(this.#rotationMatrix, this.#rotationMatrix, translationVec);
        }
        return this.#rotationMatrix;
    }

    getPosition(){return this.#position;}
    getQuat(){return this.#q;}
    getForwardVec(){
        var forward = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(forward, localForward, this.#q);
        glMatrix.vec3.normalize(forward, forward);
        return forward;
    }
    getUpVec(){
        var up = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(up, localUp, this.#q);
        glMatrix.vec3.normalize(up, up);
        return up;
    }
    getRightVec(){
        var right = glMatrix.vec3.create();
        glMatrix.vec3.transformQuat(right, localRight, this.#q);
        glMatrix.vec3.normalize(right, right);
        return right;
    }
}

class FPVCamera extends Camera{
    #keyPressedState;
    //Acceleration based yaw and pitch
    #yawPitchMaxIncrement = 3.5;
    #yawPitchMinIncrement = 1.5;
    //#yawIncrement = this.#yawPitchMinIncrement;
    #yawIncrement = 0.0;
    #pitchIncrement = 0.0;
    //#pitchIncrement = this.#yawPitchMinIncrement;
    #yawPitchAccelRate = 6.0;
    #yawPitchDecelRate = 10.0;
    #yawDecel = false;
    #pitchDecel = false;

    /*
    #posroll = glMatrix.quat.create();
    #negroll = glMatrix.quat.create();
    #posyaw = glMatrix.quat.create();
    #negyaw = glMatrix.quat.create();
    #pospitch = glMatrix.quat.create();
    #negpitch = glMatrix.quat.create();
    */
    #pitch = glMatrix.quat.create();
    #yaw = glMatrix.quat.create();

    #speeds = [0.0, 2.0, 4.0, 6.0, 8.0];
    #speedIndex = 0;

    #maxSpeed = 8;
    #minSpeed = 0;
    #accelRate = 3;
    #currentSpeed = 0;

    constructor(){
        const position = glMatrix.vec3.fromValues(0.0, 0.0, 7.0);
        super(position);//Must call super before using this
        this.#keyPressedState = {
            "a":false,
            "d":false,
            "w":false,
            "s":false,
            "ArrowLeft":false,
            "ArrowRight":false,

            "ArrowUp": false,
            "ArrowDown": false,
        }
    }

    resetCamera(){
        this.setPosition(glMatrix.vec3.fromValues(0.0, 0.0, 7.0));
        this.setQuat(glMatrix.quat.create());
        this.#speedIndex = 0;
        this.#currentSpeed = this.#minSpeed;

        this.#yawIncrement = 0;
        this.#pitchIncrement = 0;
        this.#yawDecel = false;
        this.#pitchDecel = false;

        //reset all key pressed states to false
        Object.keys(this.#keyPressedState).forEach((key) => this.#keyPressedState[key] = false);
    }

    getSpeedText(){
        //old non acceleration based
        //const percent = (this.#speeds[this.#speedIndex] / this.#speeds[this.#speeds.length - 1]) * 100
        //const str = this.#speeds[this.#speedIndex] + " (" + percent + "%)";

        const percent = Math.round((this.#currentSpeed / this.#maxSpeed) * 100);
        const roundedSpeed = Math.round((this.#currentSpeed + Number.EPSILON) * 100) / 100;
        const str = roundedSpeed + " (" + percent + "%)";
        return str;
    }

    pressKey(key, soundManager){
        if (this.#keyPressedState.hasOwnProperty(key)){
            this.#keyPressedState[key] = true;
        }
        if (key == "ArrowUp" && !this.#keyPressedState["ArrowDown"] && this.#currentSpeed < this.#maxSpeed){
            soundManager.startAccelSound();
        }
        if (key == "ArrowDown" && !this.#keyPressedState["ArrowUp"] && this.#currentSpeed > this.#minSpeed){
            soundManager.startDecelSound();
        }

    }
    releaseKey(key, soundManager){
        if (this.#keyPressedState.hasOwnProperty(key)){
            this.#keyPressedState[key] = false;
            if (key == "a" || key == "d"){
                //this.#yawIncrement = this.#yawPitchMinIncrement;
                this.#yawDecel = true;
            }
            if (key == "w" || key == "s"){
                //this.#pitchIncrement = this.#yawPitchMinIncrement;
                this.#pitchDecel = true;
            }

            if (key == "ArrowUp"){
                soundManager.stopAccelSound();
            }
            if (key == "ArrowDown"){
                soundManager.stopDecelSound();
            }
        }
    }

    updateCamera(deltaTime, soundManager){
        let updateYaw = false; let updatePitch = false;

        //if Keys are pressed then set respective decel booleans to false and update bools to true
        if (this.#keyPressedState["a"]){
            this.#yawDecel = false;
            updateYaw = true;
            this.#yawIncrement += this.#yawPitchAccelRate * deltaTime;
            if (this.#yawIncrement > this.#yawPitchMaxIncrement) this.#yawIncrement = this.#yawPitchMaxIncrement;
            glMatrix.quat.setAxisAngle(this.#yaw, localUp, toRadians(this.#yawIncrement/2));
            //this.adjustOrientation(this.#posyaw);
            //this.adjustOrientation(posyaw);
        }
        if (this.#keyPressedState["d"]){
            this.#yawDecel = false;
            updateYaw = true;
            this.#yawIncrement -= this.#yawPitchAccelRate * deltaTime;
            if (this.#yawIncrement < -1 * this.#yawPitchMaxIncrement) this.#yawIncrement = -1 * this.#yawPitchMaxIncrement;
            glMatrix.quat.setAxisAngle(this.#yaw, localUp, toRadians(this.#yawIncrement/2));
            //this.adjustOrientation(this.#negyaw);
            //this.adjustOrientation(negyaw);
        }
        if (this.#keyPressedState["w"]){
            updatePitch = true;
            this.#pitchDecel = false;

            this.#pitchIncrement += this.#yawPitchAccelRate * deltaTime;
            if (this.#pitchIncrement > this.#yawPitchMaxIncrement) this.#pitchIncrement = this.#yawPitchMaxIncrement;
            glMatrix.quat.setAxisAngle(this.#pitch, localRight, toRadians(this.#pitchIncrement/2));
            //this.adjustOrientation(this.#pospitch);
            //this.adjustOrientation(pospitch);
        }
        if (this.#keyPressedState["s"]){
            updatePitch = true;
            this.#pitchDecel = false;

            this.#pitchIncrement -= this.#yawPitchAccelRate * deltaTime;
            if (this.#pitchIncrement < -1 * this.#yawPitchMaxIncrement) this.#pitchIncrement = -1 * this.#yawPitchMaxIncrement;
            glMatrix.quat.setAxisAngle(this.#pitch, localRight, toRadians(this.#pitchIncrement/2));
            //this.adjustOrientation(this.#negpitch);
            //this.adjustOrientation(negpitch);
        }
        if (this.#keyPressedState["ArrowLeft"]){
            this.adjustOrientation(negroll);
        }
        if (this.#keyPressedState["ArrowRight"]){
            this.adjustOrientation(posroll);
        }
        //Handle Decelerations
        if (this.#yawDecel){
            if (this.#yawIncrement > 0.0){
                this.#yawIncrement -= this.#yawPitchDecelRate * deltaTime;
                if (this.#yawIncrement < 0.0){//Does deceleration overshoot 0?
                    this.#yawIncrement = 0.0;
                    this.#yawDecel = false;
                }
            }
            else{
                this.#yawIncrement += this.#yawPitchDecelRate * deltaTime;
                if (this.#yawIncrement > 0.0){//Does deceleration overshoot 0?
                    this.#yawIncrement = 0.0;
                    this.#yawDecel = false;
                }
            }
            glMatrix.quat.setAxisAngle(this.#yaw, localUp, toRadians(this.#yawIncrement/2));
            updateYaw = true;
        }
        if (this.#pitchDecel){
            if (this.#pitchIncrement > 0.0){
                this.#pitchIncrement -= this.#yawPitchDecelRate * deltaTime;
                if (this.#pitchIncrement < 0.0){//Does deceleration overshoot 0?
                    this.#pitchIncrement = 0.0;
                    this.#pitchDecel = false;
                }
            }
            else{
                this.#pitchIncrement += this.#yawPitchDecelRate * deltaTime;
                if (this.#pitchIncrement > 0.0){//Does deceleration overshoot 0?
                    this.#pitchIncrement = 0.0;
                    this.#pitchDecel = false;
                }
            }
            glMatrix.quat.setAxisAngle(this.#pitch, localRight, toRadians(this.#pitchIncrement/2));
            updatePitch = true;
        }

        if(updatePitch) this.adjustOrientation(this.#pitch);
        if (updateYaw) this.adjustOrientation(this.#yaw);


        //SPEED CALCULATIONS
        //prelim check if both up and down arrows are not pressed at the same time
        //will mess with sound otherwise
        if (!this.#keyPressedState["ArrowUp"] || !this.#keyPressedState["ArrowDown"]){
            if (this.#keyPressedState["ArrowUp"] && this.#currentSpeed < this.#maxSpeed){
                this.#currentSpeed += deltaTime * this.#accelRate;
                //soundManager.playAccelSound();
                if (this.#currentSpeed > this.#maxSpeed){
                    this.#currentSpeed = this.#maxSpeed;
                    //soundManager.stopAccelSound();
                }
            }
            else{
                //soundManager.stopAccelSound();
            }
            if (this.#keyPressedState["ArrowDown"] && this.#currentSpeed > this.#minSpeed){
                this.#currentSpeed -= deltaTime * this.#accelRate;
                //soundManager.playDecelSound();
                if (this.#currentSpeed < this.#minSpeed){
                    this.#currentSpeed = this.#minSpeed;
                    //soundManager.stopDecelSound();
                }
            }
            else{
                //soundManager.stopDecelSound();
            }
        }
        else{
            //soundManager.stopDecelSound();
            //soundManager.stopAccelSound();
        }

        //const speed = this.#speeds[this.#speedIndex];
        const speed = this.#currentSpeed;
        if (speed != 0){
            const forwardVec = this.getForwardVec();
            const moveVec = glMatrix.vec3.create();
            glMatrix.vec3.normalize(moveVec, forwardVec);

            const distance = deltaTime * speed;
            glMatrix.vec3.scale(moveVec, moveVec, distance);
            this.adjustPosition(moveVec);
        }

        if (this.#currentSpeed == this.#minSpeed){
            soundManager.stopDecelSound();
        }
        if (this.#currentSpeed == this.#maxSpeed){
            soundManager.stopAccelSound();
        }
    }
}

class ShipCamera extends Camera{
    #radius;
    #orthoProj = glMatrix.mat4.create();
    #verticalAngle = 0.0;
    #angleIncrement = 2.0;
    #keyPressedState;
    //Precomputed orientation adjustments
    #posyaw = glMatrix.quat.create();
    #negyaw = glMatrix.quat.create();

    //Preset Views
    #frontView = glMatrix.quat.create();
    #sideView = glMatrix.quat.create();
    #topView = glMatrix.quat.create();
    #viewScroll;
    #viewIndex = 0;

    constructor(pos = glMatrix.vec3.fromValues(0.0, 0.0, 0.0)){
        super(pos);//Parent Camera class makes clone of pos vector passed in
        this.#radius = 10;

        this.#keyPressedState = {
            "i":false,
            "j":false,
            "k":false,
            "l":false,
        }

        glMatrix.quat.setAxisAngle(this.#posyaw, localUp, toRadians(this.#angleIncrement)/2);
        glMatrix.quat.setAxisAngle(this.#negyaw, localUp, -1 * toRadians(this.#angleIncrement)/2);

        //3 Preset Views
        glMatrix.quat.setAxisAngle(this.#frontView, localUp, 0);
        glMatrix.quat.setAxisAngle(this.#sideView, localUp, -1 * toRadians(90.0));
        glMatrix.quat.setAxisAngle(this.#topView, localRight, -1 * toRadians(90.0));
        //this.#viewScroll = [this.#frontView, this.#sideView, this.#topView];
        this.#viewScroll = [this.#frontView, this.#topView];

        //Orthographic Projection Matrix
        const zNear = 1.0, zFar = 20.0;
        glMatrix.mat4.ortho(this.#orthoProj, -15.0, 15.0, -15.0, 15.0, zNear, zFar);
    }

    getProjMatrix(){return this.#orthoProj;}

    pressKey(key){
        if (key == "x"){
            this.#viewIndex = (this.#viewIndex + 1) % this.#viewScroll.length;
        }
        /*
        if (this.#keyPressedState.hasOwnProperty(key)){
            this.#keyPressedState[key] = true;
        }
        */
    }
    releaseKey(key){
        /*
        if (this.#keyPressedState.hasOwnProperty(key)){
            this.#keyPressedState[key] = false;
        }
        */
    }

    updateCamera(shipPos){
        /*
        const vertRotLimit = 90;


        if(this.#keyPressedState["j"]){
            this.adjustGlobalOrientation(this.#negyaw);
        }
        if(this.#keyPressedState["l"]){
            this.adjustGlobalOrientation(this.#posyaw);
        }
        if(this.#keyPressedState["i"] && this.#verticalAngle > -1 * vertRotLimit){
            const quat = glMatrix.quat.create();
            glMatrix.quat.setAxisAngle(quat, this.getRightVec(), -1 * toRadians(this.#angleIncrement));
            this.adjustGlobalOrientation(quat);
            this.#verticalAngle -= this.#angleIncrement;
            if (this.#verticalAngle < -90){
                glMatrix.quat.setAxisAngle(quat, this.getRightVec(), toRadians((-90 - this.#angleIncrement)));
                this.adjustGlobalOrientation(quat);
                this.#verticalAngle = -90.0;
            }
        }
        if(this.#keyPressedState["k"] && this.#verticalAngle < vertRotLimit){
            const quat = glMatrix.quat.create();
            glMatrix.quat.setAxisAngle(quat, this.getRightVec(), toRadians(this.#angleIncrement));
            this.adjustGlobalOrientation(quat);
            this.#verticalAngle += this.#angleIncrement;
            if (this.#verticalAngle > 90){
                glMatrix.quat.setAxisAngle(quat, this.getRightVec(), toRadians((90 - this.#angleIncrement)));
                this.adjustGlobalOrientation(quat);
                this.#verticalAngle = 90.0;
            }
        }
        */
        this.setQuat(this.#viewScroll[this.#viewIndex]);

        const newPos = glMatrix.vec3.create();
        glMatrix.vec3.scaleAndAdd(newPos, shipPos, this.getForwardVec(), -1 * this.#radius);
        this.setPosition(newPos);
    }


}

export {FPVCamera, ShipCamera};
//export {Camera};