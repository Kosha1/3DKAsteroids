import { initShaderProgram } from "./shaders.js";

class BulletManager{
        #gl;
        #buffer;

        //Fire Rate Parameters
        #playerRoundsPerSec = 2.5;
        #bulletWait = 1 / this.#playerRoundsPerSec;//minimum time to wait for next bullet
        #timeSinceFire = 0; 

        #playerFire;//toggle boolean that keeps track if player wants to fire
        #shaderInfo;
        #playerBullets;//Array containing the "bullets" fired by the player
    constructor(gl){
        this.#gl = gl;
        this.#initShaders();
        this.#initBuffer();

        this.#playerBullets = [];

        this.#playerFire = false;
    }

    #initShaders(){
        const VS = `#version 300 es
        layout (location = 0) in vec3 Pos;
        uniform mat4 uViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 modelMatrix;
        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * modelMatrix * vec4(Pos,1.0);
        }
        `;
        const FS = `#version 300 es
        out highp vec4 fragColor;
        void main() {
            fragColor = vec4(0.0, 1.0, 0.0, 1.0);//green color for lasrs
        }
        `;
        const shader = initShaderProgram(this.#gl, VS, FS);
        this.#shaderInfo = {
            program: shader,
            posAttribLoc: this.#gl.getAttribLocation(shader, "Pos"),
            ViewMatLoc: this.#gl.getUniformLocation(shader, "uViewMatrix"),
            ProjMatLoc: this.#gl.getUniformLocation(shader, "uProjectionMatrix"),
            ModelMatLoc: this.#gl.getUniformLocation(shader, "modelMatrix"),
        }
    }
    #initBuffer(){
        this.#buffer = this.#gl.createBuffer();
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#buffer);

        const cubevertices = [//cube can be scaled differently on the 3 axes later on
            //front face taken from skybox vertices: face mapping might be incorrect here
            -1.0, 1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
      
            //left face
            -1.0, -1.0,  1.0,
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
            -1.0, -1.0,  1.0,
        
            //right face
            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0, -1.0,
            1.0, -1.0, -1.0,
        
            //back face
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
        
            //top face
            -1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
        
            //bottom face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
             1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0
          ];

        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(cubevertices), this.#gl.STATIC_DRAW);

        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);
    }

    pressKey(key){
        if(key == " "){//" " is the space key
            this.#playerFire = true;
        }
    }
    releaseKey(key){
        if (key == " "){
            this.#playerFire = false;
        }
    }

    resetBullets(){//Reset Player Bullets to length 0
        this.#playerBullets.length = 0;
    }

    update(camera, deltaTime, soundManager){
        //Current Camera Parameters (Directions normalized in camera class)
        const quat = camera.getQuat();
        const camPos = camera.getPosition();
        const dir = camera.getForwardVec();
        const rightVec = camera.getRightVec();

        this.#timeSinceFire += deltaTime;
        if (this.#playerFire && this.#timeSinceFire >= this.#bulletWait){//ready to fire new bullet
            this.#playerBullets.push(new Bullet(camPos, dir, rightVec, quat));
            this.#timeSinceFire = 0.0;
            //play blaster fire sound
            soundManager.playBlasterFire();
        }

        //remove inactive bullets from array only if array get too long
        if (this.#playerBullets.length > 30){
            let inactiveCount = 0;
            while (!this.#playerBullets[inactiveCount].isActive() && inactiveCount < this.#playerBullets.length){
                inactiveCount++;
            }
            this.#playerBullets.splice(0, inactiveCount);
        }

        for(let i = 0; i < this.#playerBullets.length; ++i){
            this.#playerBullets[i].update(deltaTime);
        }
    }

    draw(camera){
        this.#gl.bindVertexArray(null);

        //Projection Matrix
        const fieldOfView = (45 * Math.PI) / 180; // in radians
        const aspect = this.#gl.canvas.clientWidth / this.#gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = glMatrix.mat4.create();
        glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        this.#gl.useProgram(this.#shaderInfo.program);
        this.#gl.uniformMatrix4fv(this.#shaderInfo.ProjMatLoc, false, projectionMatrix);
        this.#gl.uniformMatrix4fv(this.#shaderInfo.ViewMatLoc, false, camera.getViewMatrix());

        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, this.#buffer);
        this.#gl.vertexAttribPointer(this.#shaderInfo.posAttribLoc, 3, this.#gl.FLOAT, false, 0, 0);
        this.#gl.enableVertexAttribArray(this.#shaderInfo.posAttribLoc);

        for(let i = 0; i < this.#playerBullets.length; ++i){
            if (this.#playerBullets[i].isActive())
                this.#playerBullets[i].draw(this.#gl, this.#shaderInfo);
        }
    }

    getBulletsArr(){return this.#playerBullets;}
}



class Bullet{
    #speed = 30;
    #maxDistance = 70;//distance the bullet can travel before becoming inactive
    #distanceTravelled = 0;
    #active = true;//tracks if bullet is still active or should disappear
    //#modelMatrix = glMatrix.mat4.create();
    #leftModelMatrix = glMatrix.mat4.create();
    #rightModelMatrix = glMatrix.mat4.create();
    #beamOffset = 0.05;//offset of each of the two beams from the center point

    #cubeScale = glMatrix.vec3.fromValues(0.01, 0.01, 0.1);

    #worldPos;
    #prevPos;//position of the bullet last frame

    #rightVec;//camera's right vector needed in order to make two parallel laser bursts
    #leftBeamPos = glMatrix.vec3.create();
    #rightBeamPos = glMatrix.vec3.create();
    #velocityDir;
    #quat;

    constructor(originLoc, firedir, rightDir, cameraRotQuat){
        this.#worldPos = glMatrix.vec3.clone(originLoc);//location the bullet was fired from
        this.#prevPos = glMatrix.vec3.clone(originLoc);

        this.#rightVec = glMatrix.vec3.clone(rightDir);
        this.#velocityDir = glMatrix.vec3.clone(firedir);//heading of the bullet
        this.#quat = glMatrix.quat.clone(cameraRotQuat);

        //left and right beam positions
        glMatrix.vec3.scaleAndAdd(this.#leftBeamPos, this.#worldPos, this.#rightVec, -1 * this.#beamOffset);
        glMatrix.vec3.scaleAndAdd(this.#rightBeamPos, this.#worldPos, this.#rightVec, this.#beamOffset);

    }

    update(deltaTime){
        if (this.isActive()){
            //update total distance travelled
            this.#distanceTravelled += deltaTime * this.#speed;
            if (this.#distanceTravelled > this.#maxDistance){
                this.#active = false;
                return;
            }

            //store the worldPosition into prevPos
            glMatrix.vec3.copy(this.#prevPos, this.#worldPos);
            //update worldPosition
            glMatrix.vec3.scaleAndAdd(this.#worldPos, this.#worldPos, this.#velocityDir, deltaTime * this.#speed);


            //update left and right beam positions
            glMatrix.vec3.scaleAndAdd(this.#leftBeamPos, this.#worldPos, this.#rightVec, -1 * this.#beamOffset);
            glMatrix.vec3.scaleAndAdd(this.#rightBeamPos, this.#worldPos, this.#rightVec, this.#beamOffset);

            this.#updateBulletMatrix();
        }
    }

    #updateBulletMatrix(){
        //glMatrix.mat4.fromRotationTranslationScale(this.#modelMatrix, this.#quat, this.#worldPos, this.#cubeScale);
        glMatrix.mat4.fromRotationTranslationScale(this.#leftModelMatrix, this.#quat, this.#leftBeamPos, this.#cubeScale);
        glMatrix.mat4.fromRotationTranslationScale(this.#rightModelMatrix, this.#quat, this.#rightBeamPos, this.#cubeScale);
    }

    draw(gl, shaderInfo){
        //gl.uniformMatrix4fv(shaderInfo.ModelMatLoc, false, this.#modelMatrix);
        gl.uniformMatrix4fv(shaderInfo.ModelMatLoc, false, this.#leftModelMatrix);
        gl.drawArrays(gl.TRIANGLES, 0, 36);

        gl.uniformMatrix4fv(shaderInfo.ModelMatLoc, false, this.#rightModelMatrix);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }

    isActive(){return this.#active;}
    setInactive(){this.#active = false;}

    getWorldPos(){return this.#worldPos;}
    getBulletLineSegment(){
        return ([this.#prevPos, this.#worldPos]);
    }

}

export {BulletManager};