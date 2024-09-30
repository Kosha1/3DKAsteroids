import { getRandomInt } from "./asteroidmanager.js";

class Ship{

    constructor(model, gl){
        this.gl = gl;//ONLY NEEDED FOR DEBUG PURPOSES

        this.model = model;
        this.buffer = model.CPUArray;

        this.meshes = model.meshes;
        this.modelMatrix = glMatrix.mat4.create();

        //store references to the model mesh parameters: matrices, maxes, mins
        this.numMeshes = model.meshes.length;
        this.meshMatrices = new Array(this.numMeshes);
        this.defaultMaxes = new Array(this.numMeshes);
        this.defaultMins = new Array(this.numMeshes);

        //These will be the default sole bounding box of the star destroyer encompassing all the meshes|updated in the for loop
        this.defglobalMax = glMatrix.vec3.clone(this.meshes[0].max);
        this.defglobalMin = glMatrix.vec3.clone(this.meshes[0].min);
        for (let i = 0; i < this.numMeshes; ++i){
            this.defaultMaxes[i] = this.meshes[i].max;
            this.defaultMins[i] = this.meshes[i].min;
            this.meshMatrices[i] = this.meshes[i].transformMatrix;

            //global bounding box logic
            if (i != 15){//mesh 15 bounding box is left out due to its inaccuracy
                if (this.defaultMaxes[i][0] > this.defglobalMax[0]) this.defglobalMax[0] = this.defaultMaxes[i][0];
                if (this.defaultMaxes[i][1] > this.defglobalMax[1]) this.defglobalMax[1] = this.defaultMaxes[i][1];
                if (this.defaultMaxes[i][2] > this.defglobalMax[2]) this.defglobalMax[2] = this.defaultMaxes[i][2];

                if (this.defaultMins[i][0] < this.defglobalMin[0]) this.defglobalMin[0] = this.defaultMins[i][0];
                if (this.defaultMins[i][1] < this.defglobalMin[1]) this.defglobalMin[1] = this.defaultMins[i][1];
                if (this.defaultMins[i][2] < this.defglobalMin[2]) this.defglobalMin[2] = this.defaultMins[i][2];
            }
        }

        //The constantly updated global max and min of the model
        this.currentGlobalMax = glMatrix.vec3.create();
        this.currentGlobalMin = glMatrix.vec3.create();


        this.scale = 0.01;
        this.worldPos = glMatrix.vec3.fromValues(0.0, 0.0, -10.0);
        this.rotAngle = 0 * Math.PI / 180;

        this.#updateModelMatrix();

        this.speed = 0.0;
        this.velocityDir = glMatrix.vec3.fromValues(0.0, 0.0, 1.0);

        
        //Mesh indices manually checked that significantly contribute to the star destroyer structure
        const meshIndices = [10, 14, 19, 20, 21];
        this.pointArrays = new Array(meshIndices.length);
        for (let i = 0; i < this.pointArrays.length; ++i){
            this.pointArrays[i] = this.#getMeshPoints(meshIndices[i]);
        }

        //debugging boxes
        this.#initBoxBuffers();
    }

    getOBBPoints(index){//index of the desired mesh; points in the oriented bounding box
        //const max = glMatrix.vec3.create();
        //glMatrix.vec3.scale(max, this.defaultMaxes[index], this.scale);
        //const min = glMatrix.vec3.create();
        //glMatrix.vec3.scale(min, this.defaultMins[index], this.scale);

        //The model matrix should automatically take care of scaling
        const max = glMatrix.vec3.clone(this.defaultMaxes[index]);
        const min = glMatrix.vec3.clone(this.defaultMins[index]);


        const xLength = max[0] - min[0];
        const yLength = max[1] - min[1];
        const zLength = max[2] - min[2];
        const pointDim = 10;//number of points along 1 axis of cube

        const pointArray = new Array(pointDim * pointDim * pointDim);

        let pointIndex = 0;
        for (let i = 0; i < pointDim; ++i){
            const xOffset = i * xLength / pointDim;
            const xCoord = min[0] + xOffset;
            for (let j = 0; j < pointDim; ++j){
                const yOffset = j * yLength / pointDim;
                const yCoord = min[1] + yOffset;
                for(let k = 0; k < pointDim; ++k){
                    const zOffset = k * zLength / pointDim;
                    const zCoord = min[2] + zOffset;

                    pointArray[pointIndex] = glMatrix.vec3.fromValues(xCoord, yCoord, zCoord);
                    pointIndex++;
                }
            }
        }

        //Transform all the points by the model matrix multiplied with the mesh matrix
        const fullTransformMat = glMatrix.mat4.create();
        glMatrix.mat4.multiply(fullTransformMat, this.modelMatrix, this.meshMatrices[index]);
        for (let i = 0; i < pointArray.length; i++){
            glMatrix.vec3.transformMat4(pointArray[i], pointArray[i], fullTransformMat);
        }

        return pointArray;
    }

    #getMeshPoints(index){//index of desired mesh
        /* OLD CODE NOT NEEDED ANYMORE
        const fullTransformMat = glMatrix.mat4.create();
        glMatrix.mat4.multiply(fullTransformMat, this.modelMatrix, this.meshMatrices[index]);
        */
        const positionSpec = this.meshes[index].attributes.position;

        const float32ByteLength = 4;
        const OffsetIndex = positionSpec.totalByteOffset / float32ByteLength;//offset index of the model buffer for vertices
        const indexStride = positionSpec.byteStride / float32ByteLength;//how many indices to stride for next vertex
        const numVertices = positionSpec.count;

        const pointArray = new Array(numVertices);

        for(let i = 0; i < numVertices; ++i){
            const xPos = this.buffer[OffsetIndex + i * indexStride];
            const yPos = this.buffer[OffsetIndex + i * indexStride + 1];
            const zPos = this.buffer[OffsetIndex + i * indexStride + 2];

            pointArray[i] = glMatrix.vec3.fromValues(xPos, yPos, zPos);
        }
        /* OLD CODE NOT NEEDED ANYMORE
        for (let i = 0; i < pointArray.length; i++){
            glMatrix.vec3.transformMat4(pointArray[i], pointArray[i], fullTransformMat);
        }
        */

        //return a javascript object containing the index of the mesh and the array of default vertices (in local space)
        return {
            index: index,
            points: pointArray
        };
    }

    getRandomShipVertex(){//returns a random point of the ship transformed to world space
        const randMeshIndex = getRandomInt(0, this.pointArrays.length);
        const randVertexIndex = getRandomInt(0, this.pointArrays[randMeshIndex].points.length);
        const fullPointTransform = glMatrix.mat4.create();
        glMatrix.mat4.multiply(fullPointTransform, this.modelMatrix, this.meshMatrices[randMeshIndex]);
        const vertex = glMatrix.vec3.clone(this.pointArrays[randMeshIndex].points[randVertexIndex]);
        glMatrix.vec3.transformMat4(vertex, vertex, fullPointTransform);
        return vertex;
    }

    renderDepth(shipCam = undefined){
        this.model.renderDepth(this.modelMatrix, this.worldPos, shipCam);
    }

    draw(camera, sunlightdir, depthMap){
        this.model.draw(this.modelMatrix, camera, sunlightdir, depthMap);
    }

    update(deltaTime){
        //update Position of starDestroyer
        glMatrix.vec3.scaleAndAdd(this.worldPos, this.worldPos, this.velocityDir, deltaTime * this.speed);

        this.#updateModelMatrix();
        this.#recalcGlobalBoundingBox();
    }

    #recalcGlobalBoundingBox(){
        const localMax = glMatrix.vec3.create();//bounding box centered at (0,0,0)
        const localMin = glMatrix.vec3.create();
        glMatrix.vec3.scale(localMax, this.defglobalMax, this.scale);
        glMatrix.vec3.scale(localMin, this.defglobalMin, this.scale);

        glMatrix.mat3.copy(this.currentGlobalMax, this.worldPos);
        glMatrix.mat3.copy(this.currentGlobalMin, this.worldPos);

        const rotMatrix = glMatrix.mat3.create();
        const rot4x4Mat = glMatrix.mat4.create();
        glMatrix.mat4.fromRotation(rot4x4Mat, this.rotAngle, [0.0, 1.0, 0.0]);//currently no rotations in place
        glMatrix.mat3.fromMat4(rotMatrix, rot4x4Mat);
        glMatrix.mat3.transpose(rotMatrix, rotMatrix);//needed since matrix is stored in column major order

        //Arvo method to "find the extreme points by considering the product of the
        //min and max with each component of M". (From Real Time Collision book)
        for (let i = 0; i < 3; ++i){
            for(let j = 0; j < 3; ++j){
                let a = rotMatrix[i*3 + j] * localMin[j];
                let b = rotMatrix[i*3 + j] * localMax[j];
                if (a < b){
                    this.currentGlobalMin[i] += a;
                    this.currentGlobalMax[i] += b;
                }
                else{
                    this.currentGlobalMin[i] += b;
                    this.currentGlobalMax[i] += a;
                }
            }
        }
    }

    #updateModelMatrix(){
        glMatrix.mat4.identity(this.modelMatrix);

        glMatrix.mat4.translate(this.modelMatrix, this.modelMatrix, this.worldPos);
        glMatrix.mat4.rotate(this.modelMatrix, this.modelMatrix, this.rotAngle, [0.0, 1.0, 0.0]);
        glMatrix.mat4.scale(this.modelMatrix, this.modelMatrix, [this.scale, this.scale, this.scale]);

        return this.modelMatrix;
    }

    getModelMatrix(){return this.modelMatrix;}
    getWorldPos(){return this.worldPos;}
    getPointArrays(){return this.pointArrays;}
    getMeshMatrices(){return this.meshMatrices;}
    getGlobalMax(){return this.currentGlobalMax;}
    getGlobalMin(){return this.currentGlobalMin;}

    //debugging draw bounding boxes
    #initBoxBuffers(){
        //this.AABBarr = new Float32Array(this.numMeshes*8*3);//8 points per meshbox; 3 vertices per point
        this.AABBarr = new Float32Array((this.numMeshes-1)*8*3);//8 points per meshbox; 3 vertices per point
        //line indices created once and never changed
        //this.AABBIndexArr = new Uint16Array(this.numMeshes*24);
        this.AABBIndexArr = new Uint16Array((this.numMeshes-1)*24);

        let astIndex = 0;
        for (let i = 0; i < this.numMeshes; ++i){
            if (i != 15){//MESH 15 has bad bounding box. Not including it doesn't change overall ship bounds 
            const max = glMatrix.vec3.clone(this.defaultMaxes[i]);
            const min = glMatrix.vec3.clone(this.defaultMins[i]);

            const fullTransformMat = glMatrix.mat4.create();
            glMatrix.mat4.multiply(fullTransformMat, this.modelMatrix, this.meshMatrices[i]);
            glMatrix.vec3.transformMat4(max, max, fullTransformMat);
            glMatrix.vec3.transformMat4(min, min, fullTransformMat);


            this.AABBarr[astIndex] = max[0]; this.AABBarr[astIndex+1] = max[1]; this.AABBarr[astIndex+2] = max[2];
            this.AABBarr[astIndex+3] = max[0]; this.AABBarr[astIndex+4] = max[1]; this.AABBarr[astIndex+5] = min[2];
            this.AABBarr[astIndex+6] = min[0]; this.AABBarr[astIndex+7] = max[1]; this.AABBarr[astIndex+8] = min[2];
            this.AABBarr[astIndex+9] = min[0]; this.AABBarr[astIndex+10] = max[1]; this.AABBarr[astIndex+11] = max[2];
            this.AABBarr[astIndex+12] = max[0]; this.AABBarr[astIndex+13] = min[1]; this.AABBarr[astIndex+14] = max[2];
            this.AABBarr[astIndex+15] = max[0]; this.AABBarr[astIndex+16] = min[1]; this.AABBarr[astIndex+17] = min[2];
            this.AABBarr[astIndex+18] = min[0]; this.AABBarr[astIndex+19] = min[1]; this.AABBarr[astIndex+20] = min[2];
            this.AABBarr[astIndex+21] = min[0]; this.AABBarr[astIndex+22] = min[1]; this.AABBarr[astIndex+23] = max[2];
            astIndex += 8*3
            }
        }

        for (let i = 0; i < this.numMeshes-1; ++i){
            this.AABBIndexArr.set([0+8*i,1+8*i,0+8*i,3+8*i,0+8*i,4+8*i,1+8*i,
                2+8*i,1+8*i,5+8*i,2+8*i,3+8*i,2+8*i,6+8*i,3+8*i,7+8*i,7+8*i,6+8*i,
                7+8*i,4+8*i,4+8*i,5+8*i,5+8*i,6+8*i], 24 * i);
        }

        this.gl.bindVertexArray(null);
        this.AABBBuff = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.AABBBuff);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.AABBarr, this.gl.STATIC_DRAW);

        this.AABBIndexBuff = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.AABBIndexBuff);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.AABBIndexArr, this.gl.STATIC_DRAW);
        
    }
}

export {Ship};