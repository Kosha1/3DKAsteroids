
class Asteroid{
    invMeshTransform = glMatrix.mat4.create();

    velocityDir;
    speed;

    rotationAxis;
    rotSpeed;

    scale;

    transformMatrix = glMatrix.mat4.create();
    center;
    scaledCenter = glMatrix.vec3.create();
    worldPos;

    runningAngle = 0.0;

    active = true;//Active asteroid means asteroid not exploding

    //The current bounding box min and max of asteroid
    currentMax;
    currentMin;

    constructor(mesh, index){
        this.mesh = mesh;
        this.astIndex = index;

        this.#initCenter();

        
        //Both max and min must be vec3(the default values from the gltf file)
        //These defualt values are for a scale 1.0
        this.defaultMax = mesh.max;
        this.defaultMin = mesh.min;


        this.mesh.transformMatrix = glMatrix.mat4.create();//!!!!!overrides the mesh transform matrix of the original model!!!!!
        
        this.rotationAxis = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);

    }

    //SIMPLY USING THESE VALUES WITH ARBITRATY SCALE WILL RESULT IN INCORRECT ROTATIONS (ORBITING)
    #initCenter(){//THESE CENTER COORDINATES ARE ONLY VALID FOR A SCALE OF 0.1
        switch(this.astIndex){
            case 0:
                this.center = glMatrix.vec3.fromValues(0.0, -1.3, 0.0);
                break;
            case 1:
                this.center = glMatrix.vec3.fromValues(-1.3, -1.3, 0.0);
                break;
            case 2:
                this.center = glMatrix.vec3.fromValues(1.25, 0.0, 0.0);
                break;
            case 3:
                this.center = glMatrix.vec3.fromValues(0.0, 0.0, 0.0);
                break;
            case 4:
                this.center = glMatrix.vec3.fromValues(-1.3, 0.0, 0.0);
                break;
            case 5:
                this.center = glMatrix.vec3.fromValues(1.25, 1.5, 0.0);
                break;
            case 6:
                this.center = glMatrix.vec3.fromValues(-0.1, 1.4, 0.0);
                break;
            case 7:
                this.center = glMatrix.vec3.fromValues(-1.4, 1.4, 0.0);
                break;
            case 8:
                this.center = glMatrix.vec3.fromValues(0.0, 2.85, 0.0);
                break;
            case 9:
                this.center = glMatrix.vec3.fromValues(1.3, -1.4, 0.0);
                break;
            default:
                console.log("ERROR: ASTEROID INDEX NOT FOUND");
                break;
        }
    }

    setRotAxis(vec){this.rotationAxis = vec;}
    setPosition(vec){this.worldPos = vec;}

    //set the scaled center here as well
    setScale(num){
        this.scale = num;
        glMatrix.vec3.scale(this.scaledCenter, this.center, this.scale / 0.1);
    }
    setVelocityDir(vec){this.velocityDir = vec;}
    setSpeed(num){this.speed = num;}
    setRotSpeed(num){this.rotSpeed = num;}//should be in radians

    getWorldPos(){return this.worldPos;}
    getVelocityDir(){return this.velocityDir;}
    getScale(){return this.scale;}

    updatePosition(deltaTime){
        //update worldPosition
        glMatrix.vec3.scaleAndAdd(this.worldPos, this.worldPos, this.velocityDir, deltaTime * this.speed);

        //update current rotation angle
        this.runningAngle = (this.runningAngle + deltaTime * this.rotSpeed) % (2 * Math.PI);

        //this.recalcBoundingBox();
    }

    initBoundingBox(){//at start the running Angle is 0 so no need to account for any rotations
        this.currentMax = glMatrix.vec3.create();
        this.currentMin = glMatrix.vec3.create();
        //first scale the bounding box to the scale of the asteroid
        glMatrix.vec3.scale(this.currentMax, this.defaultMax, this.scale);
        glMatrix.vec3.scale(this.currentMin, this.defaultMin, this.scale);

        const translationVec = glMatrix.vec3.create();
        //Since asteroid is off center and has a world pos: use worldPos - ScaledCenter as translation vector
        glMatrix.vec3.subtract(translationVec, this.worldPos, this.scaledCenter);

        //Now translate the bounding box to the world pos of the asteroid
        glMatrix.vec3.add(this.currentMax, this.currentMax, translationVec);
        glMatrix.vec3.add(this.currentMin, this.currentMin, translationVec);
    }

    recalcBoundingBox(){

        //Only translate the bounding box do not rotate anything 
        glMatrix.vec3.scale(this.currentMax, this.defaultMax, this.scale);
        glMatrix.vec3.scale(this.currentMin, this.defaultMin, this.scale);
        const translationVec = glMatrix.vec3.create();
        //Since asteroid is off center and has a world pos: use worldPos - ScaledCenter as translation vector
        glMatrix.vec3.subtract(translationVec, this.worldPos, this.scaledCenter);

        //Now translate the bounding box to the world pos of the asteroid
        glMatrix.vec3.add(this.currentMax, this.currentMax, translationVec);
        glMatrix.vec3.add(this.currentMin, this.currentMin, translationVec);
    }

    getModelMatrix(){//generate the transformation matrix for the asteroid
        //Get negative of the SCALED CENTER Vector
        const negscaledCenter = glMatrix.vec3.create();
        glMatrix.vec3.scale(negscaledCenter, this.scaledCenter, -1.0);


        const translationVec = glMatrix.vec3.create();
        //Since asteroid is off center and has a world pos: use worldPos - ScaledCenter as translation vector
        glMatrix.vec3.subtract(translationVec, this.worldPos, this.scaledCenter);

        //IT IS ESSENTIAL TO CALCULATE THE SCALED CENTER AND USE THAT TO TRANSLATE TO ORIGIN AND BACK
        glMatrix.mat4.identity(this.transformMatrix);//reset and build the matrix from scratch every time
        glMatrix.mat4.translate(this.transformMatrix, this.transformMatrix, translationVec);//translation to worldPos

        //Translation to origin and back to get the rotation around the objects own axis
        glMatrix.mat4.translate(this.transformMatrix, this.transformMatrix, this.scaledCenter);
        glMatrix.mat4.rotate(this.transformMatrix, this.transformMatrix, this.runningAngle, this.rotationAxis);
        glMatrix.mat4.translate(this.transformMatrix, this.transformMatrix, negscaledCenter);

        glMatrix.mat4.scale(this.transformMatrix, this.transformMatrix, [this.scale, this.scale, this.scale]);

        this.recalcBoundingBox();

        return this.transformMatrix;
    }

    getMax(){return this.currentMax;}
    getMin(){return this.currentMin;}

}


/*
* PRELIMINARY INFORMATION ON THE CENTERS OF THE ASTEROIDS: the first translation (center) negate the 2nd translation
* !!!!!!!!!IMPORTANT!!!!!!!!!!!!!
* These centers are only valid for a scale value of 0.1. DIFFERENT SCALES WILL NEED TO UPSCALE THE CENTER LINEARLY
* Mesh 0: [0.0, -1.3, 0.0]
* Mesh 1: [-1.3, -1.3, 0.0] first translation (center);order of operations seems to be reversed
* Mesh 2: [1.25, 0.0, 0.0]
* Mesh 3: [0.0, 0.0, 0.0] DEFUALT ORIGIN ASTEROID
* Mesh 4: [-1.3, 0.0, 0.0]
* Mesh 5: [1.25, 1.5, 0.0]
* Mesh 6: [-0.1, 1.4, 0.0]
* Mesh 7: [-1.4, 1.4, 0.0]
* Mesh 8: [0.0, 2.85, 0.0]
* Mesh 9: [1.3, -1.4, 0.0]
*
*/


export {Asteroid};