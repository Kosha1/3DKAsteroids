import { Asteroid } from "./asteroid.js";
import { initShaderProgram } from "./shaders.js";

class AsteroidManager{
    constructor(gl, count, meshList, instShadInfo, instDepthInfo){

        this.gl = gl;

        /*
        * For Debugging Purposes Only: bounding box visualization buffers
        */
        this.AABBarr = new Float32Array(count*8*3);//8 points per cube; 3 vertices per point
        //line indices created once and never changed
        this.AABBIndexArr = new Uint16Array(count*24);

        //RESUME ESSENTIAL PARTS

        this.instanceShaderInfo = instShadInfo;
        this.instDepthShaderInfo = instDepthInfo;

        this.distinctMeshCount = meshList.length;
        this.meshList = meshList;

        this.numAsteroids = count;

        //Initialization of astList Array of Arrays (subarrays are not of same size)
        this.astList = new Array(meshList.length);//array of arrays of asteroids (1 array for each distinct mesh)
        for (let i = 0; i < meshList.length; i++){
            this.astList[i] = [];
        }

        //Initialize all asteroids and add them to respective subarray of astList
        for(let i = 0; i < count; i++){
            
            let astIndex = getRandomInt(0, meshList.length);
            //let astIndex = 3;
            let asteroid = new Asteroid(meshList[astIndex], astIndex);
            //initialize random parameters of the asteroid
            asteroid.setRotAxis(getRandUnitVec());
            //asteroid.setRotAxis(glMatrix.vec3.fromValues(1.0, 0.0, 0.0));
            asteroid.setPosition(getRandPosition());
            //asteroid.setPosition(glMatrix.vec3.fromValues(0.0, 1.0, -0.0));
            asteroid.setScale(getRandomArbitrary(0.2, 0.3));
            //asteroid.setScale(0.5);
            asteroid.setVelocityDir(getRandUnitVec());
            //asteroid.setVelocityDir(glMatrix.vec3.fromValues(1.0, 0.0, 0.0));
            asteroid.setSpeed(getRandomArbitrary(0.3, 2.0));
            //asteroid.setSpeed(0.0);
            asteroid.setRotSpeed(getRandomArbitrary(0.0, Math.PI));//in radians
            //asteroid.setRotSpeed(0);

            asteroid.initBoundingBox();
            this.astList[astIndex].push(asteroid);
            
            /*
            if (i == 0){
                let astIndex = getRandomInt(0, meshList.length);
                let asteroid = new Asteroid(meshList[astIndex], astIndex);
                asteroid.setRotAxis(getRandUnitVec());
                asteroid.setPosition(glMatrix.vec3.fromValues(20.0, 0.0, -10.0));//was [20, 1, -2]
                //asteroid.setScale(getRandomArbitrary(0.05, 0.3));
                asteroid.setScale(0.3);
                asteroid.setVelocityDir(glMatrix.vec3.fromValues(-1.0, 0.0, 0.0));
                asteroid.setSpeed(getRandomArbitrary(0.0, 3));
                asteroid.setRotSpeed(getRandomArbitrary(0.0, Math.PI));//in radians
                asteroid.initBoundingBox();
                this.astList[astIndex].push(asteroid);
            }
            if (i == 1){
                let astIndex = getRandomInt(0, meshList.length);
                let asteroid = new Asteroid(meshList[astIndex], astIndex);
                asteroid.setRotAxis(getRandUnitVec());
                asteroid.setPosition(glMatrix.vec3.fromValues(-10.0, 0.0, -10.0));
                //asteroid.setScale(getRandomArbitrary(0.05, 0.3));
                asteroid.setScale(0.2);
                asteroid.setVelocityDir(glMatrix.vec3.fromValues(1.0, 0.0, 0.0));
                asteroid.setSpeed(getRandomArbitrary(0.0, 3));
                asteroid.setRotSpeed(getRandomArbitrary(0.0, Math.PI));//in radians
                asteroid.initBoundingBox();
                this.astList[astIndex].push(asteroid);
            }
            */
            
        }
        //Typed Array Buffers that will then directly be sent to GPU
        this.modelMatArr = new Float32Array(count * 16);
        this.normalMatArr = new Float32Array(count * 9);

        //0.0 because this is the first initilization (no time has passed)
        //this.#updateMatrixArrays(0.0);//actually fill the matrix Arrays with the matrices for the 1st time
        this.update(0.0);

        this.#createBuffers();
        this.#initMeshVaos();
    }

    //Iterate through all asteroids in astList and set a new arbitrary position
    //All other parameters: speed, rotAxis do not need to be changed
    resetAsteroids(){
        for(let i = 0; i < this.distinctMeshCount; i++){
            for(let j = 0; j < this.astList[i].length; j++){
                this.astList[i][j].setPosition(getRandPosition());
            }
        }
    }

    update(deltaTime){
        this.#updateMatrixArrays(deltaTime);

        //Debugging Bounding Box Visualization
        this.updateBoundBoxBuff();

        if (deltaTime > 0.0){
            this.#updateGLBuffers();
        }
    }

    #updateMatrixArrays(deltaTime){//change position of all asteroids
        let asteroidIndex = 0;
        for(let i = 0; i < this.distinctMeshCount; i++){
            for(let j = 0; j < this.astList[i].length; j++){
                this.astList[i][j].updatePosition(deltaTime);
                const modelMatrix = this.astList[i][j].getModelMatrix();
                const normalMatrix = glMatrix.mat3.create();
                glMatrix.mat3.normalFromMat4(normalMatrix, modelMatrix);
                //Put the matrices into this.modelMatArr and this.normalMatArr now
                for (let a = 0; a < 16; ++a){
                    this.modelMatArr[asteroidIndex * 16 + a] = modelMatrix[a];
                }
                for (let b = 0; b < 9; ++b){
                    this.normalMatArr[asteroidIndex * 9 + b] = normalMatrix[b];
                }

                asteroidIndex++;
            }
        }
    }

    //each of the 10 meshes will need their own VAO however the matrix buffers will be the same
    //the vao for the nth mesh will just offset the previous number of asteroids in matrix arrays
    #initMeshVaos(){//THIS ALSO INCLUDES DEPTH VAO INITIALIZATION
        this.VAOarr = new Array(this.distinctMeshCount);
        this.depthVAOarr = new Array(this.distinctMeshCount);

        let prevAstNum = 0;//running count of the number of previous total asteroids(how many matrices to offset)
        for (let i = 0; i < this.distinctMeshCount; ++i){
            this.VAOarr[i] = initInstancedVAO(this.gl, this.meshList[i], this.instanceShaderInfo,
                this.modelMatBuffer, this.normalMatBuffer, prevAstNum
            );
            this.depthVAOarr[i] = initInstanceDepthVAO(this.gl, this.meshList[i], this.instDepthShaderInfo,
                this.modelMatBuffer, prevAstNum
            );
            prevAstNum += this.astList[i].length;
        }
    }

    #createBuffers(){
        const modelMatBuffSize = this.numAsteroids * 16 * Float32Array.BYTES_PER_ELEMENT;//4x4 matrix
        const normalMatBuffSize = this.numAsteroids * 9 * Float32Array.BYTES_PER_ELEMENT;//3x3 matrix


        this.modelMatBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.modelMatBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.modelMatArr, this.gl.STREAM_DRAW);//was DYNAMIC_DRAW

        //Normal Matrix Array Buffer Creation and Allocation
        this.normalMatBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalMatBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.normalMatArr, this.gl.STREAM_DRAW);//was DYNAMIC_DRAW

        //DEBUGGING BOUNDING BOX VISUALIZATION
        this.AABBBuff = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.AABBBuff);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.AABBarr, this.gl.STREAM_DRAW);

        this.AABBIndexBuff = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.AABBIndexBuff);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.AABBIndexArr, this.gl.STATIC_DRAW);

    }

    #updateGLBuffers(){
        //IN ORPHANING THE BUFFER SHOULD BE THE SAME LENGTH
        const modelMatBuffSize = this.numAsteroids * 16 * Float32Array.BYTES_PER_ELEMENT;//4x4 matrix
        const normalMatBuffSize = this.numAsteroids * 9 * Float32Array.BYTES_PER_ELEMENT;//3x3 matrix

        //update model matrix buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.modelMatBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, modelMatBuffSize, this.gl.STREAM_DRAW);//ORPHANING TECHNIQUE
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.modelMatArr);

        //update normal matrix buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalMatBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, normalMatBuffSize, this.gl.STREAM_DRAW);//ORPHANING TECHNIQUE
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.normalMatArr);


        //update bounding box point buffer
        const AABBBUFFSize = this.numAsteroids * 24 * Float32Array.BYTES_PER_ELEMENT;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.AABBBuff);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, AABBBUFFSize, this.gl.STREAM_DRAW);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.AABBarr);
        
        
        /*
        //WITHOUT ORPHANING: IMPLICIT SYNCHRONIZATION
        //ON LAPTOP WITH 2000 Asteroids this results in 50-55 avg fps while with orphaning laptop holds 60 fps
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.modelMatBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.modelMatArr);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalMatBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.normalMatArr);
        */

    }

    updateBoundBoxBuff(){
        let astIndex = 0;
        for(let i = 0; i < this.distinctMeshCount; i++){
            for(let j = 0; j < this.astList[i].length; j++){
                const max = this.astList[i][j].currentMax;
                const min = this.astList[i][j].currentMin;
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

        for (let i = 0; i < this.numAsteroids;i++){
            this.AABBIndexArr.set([0+8*i,1+8*i,0+8*i,3+8*i,0+8*i,4+8*i,1+8*i,
                2+8*i,1+8*i,5+8*i,2+8*i,3+8*i,2+8*i,6+8*i,3+8*i,7+8*i,7+8*i,6+8*i,
                7+8*i,4+8*i,4+8*i,5+8*i,5+8*i,6+8*i], 24 * i);
        }

    }

    renderDepth(shipCenter, radarCam = undefined){
        //this.astList.forEach((mesh)=>{mesh.forEach((element) => element.renderDepth())});
        this.gl.useProgram(this.instDepthShaderInfo.program);

        if (radarCam == undefined){//Regular Shadow Mapping Matrix uniform initialization
            //NEW TRY TO INSTANCE DRAW INTO DEPTH BUFFER
            const orthoProj = glMatrix.mat4.create();
            const zNear = 2.0, zFar = 18.0;
            glMatrix.mat4.ortho(orthoProj, -20.0, 20.0, -20.0, 20.0, zNear, zFar);

            const lightView = glMatrix.mat4.create();
            const eyePos = glMatrix.vec3.fromValues(shipCenter[0] - 10.0, shipCenter[1], shipCenter[2]);
            //glMatrix.mat4.lookAt(lightView, [-10.0, 0.0, -10.0], [0.0, 0.0, -10.0], [0.0, 1.0, 0.0]);
            glMatrix.mat4.lookAt(lightView, eyePos, shipCenter, [0.0, 1.0, 0.0]);

            const lightSpaceMatrix = glMatrix.mat4.create();
            glMatrix.mat4.multiply(lightSpaceMatrix, orthoProj, lightView);
            this.lightSpaceMatrix = lightSpaceMatrix;//store matrix as field since actual shader will need it

            this.gl.uniformMatrix4fv(this.instDepthShaderInfo.lightSpaceMatrix, false, lightSpaceMatrix);
        }
        else{
            const radarSpaceMatrix = glMatrix.mat4.create();
            glMatrix.mat4.multiply(radarSpaceMatrix, radarCam.getProjMatrix(), radarCam.getViewMatrix());
            this.gl.uniformMatrix4fv(this.instDepthShaderInfo.lightSpaceMatrix, false, radarSpaceMatrix);
        }

        for (let i = 0; i < this.distinctMeshCount; ++i){
            if (this.astList[i].length > 0){
                const mesh = this.meshList[i];
                this.gl.bindVertexArray(this.depthVAOarr[i]);
                if (mesh.indexDraw){
                    const vertexCount = mesh.attributes.index.count;
                    const offset = mesh.attributes.index.totalByteOffset;
                    const type = mesh.attributes.index.type;
                    this.gl.drawElementsInstanced(mesh.drawMode, vertexCount, type, offset, this.astList[i].length);
                }
            }
        }
        
        
    }

    draw(camera, lightdir, depthMap){
        //this.astList.forEach((mesh)=>{mesh.forEach((element) => element.draw(camera, lightdir, depthMap))});

        
        //Instanced Based Drawing
        this.gl.useProgram(this.instanceShaderInfo.program);
        this.gl.uniform3fv(this.instanceShaderInfo.uniformLocations.camPos, camera.getPosition());
        this.gl.uniformMatrix4fv(this.instanceShaderInfo.uniformLocations.viewMatrix, false, camera.getViewMatrix());

        //directional light
        this.gl.uniform3fv(this.instanceShaderInfo.uniformLocations.lightDir, lightdir);
        //attach light space transform matrix
        this.gl.uniformMatrix4fv(this.instanceShaderInfo.uniformLocations.lightSpaceMatrix, false, this.lightSpaceMatrix);

        //attach shadow map texture
        this.gl.activeTexture(this.gl.TEXTURE3);
        this.gl.bindTexture(this.gl.TEXTURE_2D, depthMap);
        this.gl.uniform1i(this.instanceShaderInfo.uniformLocations.shadowMap, 3);

        //Projection Matrix
        const fieldOfView = (45 * Math.PI) / 180; // in radians
        const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = glMatrix.mat4.create();
        glMatrix.mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
        this.gl.uniformMatrix4fv(this.instanceShaderInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

        for (let i = 0; i < this.distinctMeshCount; ++i){
            if (this.astList[i].length > 0){
                const mesh = this.meshList[i];
                this.gl.bindVertexArray(this.VAOarr[i]);

                this.gl.uniform4fv(this.instanceShaderInfo.uniformLocations.baseColor, mesh.material.PBR.colorFactor);
                this.gl.uniform1f(this.instanceShaderInfo.uniformLocations.metallic, mesh.material.PBR.metallicFactor);
                this.gl.uniform1f(this.instanceShaderInfo.uniformLocations.roughness, mesh.material.PBR.roughnessFactor);
                this.gl.uniform1f(this.instanceShaderInfo.uniformLocations.ao, 1.0);//ao can be optionally supplied as a texture only
                if (mesh.indexDraw){
                
                    if (mesh.textureIndex != -1){//attach a texture
                        //console.log("Texture active")
                        this.gl.activeTexture(this.gl.TEXTURE0);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, mesh.textures[mesh.textureIndex + 2]);
                        this.gl.uniform1i(this.instanceShaderInfo.uniformLocations.albedoMap, 0);
    
                        if(mesh.material.normalTexIndex != undefined){//normal map present
                            
                            this.gl.activeTexture(this.gl.TEXTURE1);
                            this.gl.bindTexture(this.gl.TEXTURE_2D, mesh.textures[mesh.material.normalTexIndex + 2]);
                            this.gl.uniform1i(this.instanceShaderInfo.uniformLocations.normalMap, 1);
                            if(mesh.material.normalTexCoordsIndex != 0){
                                console.log("Normal Tex Coords not same as albedo (image) texcoords");
                            }
                        }
                    }
                    else {
                        //console.log("No Texture active")
                        this.gl.activeTexture(this.gl.TEXTURE2);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, mesh.textures[0]);
                        this.gl.uniform1i(this.instanceShaderInfo.uniformLocations.albedoMap, 2);
    
                        this.gl.activeTexture(this.gl.TEXTURE1);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, mesh.textures[1]);
                        this.gl.uniform1i(this.instanceShaderInfo.uniformLocations.normalMap, 1);
                    }
                                    
                    const vertexCount = mesh.attributes.index.count;
                    const offset = mesh.attributes.index.totalByteOffset;
                    const type = mesh.attributes.index.type;
                    this.gl.drawElementsInstanced(mesh.drawMode, vertexCount, type, offset, this.astList[i].length);
                    
                }
                else console.log("Some Mesh Doesn't have index draw");
            }
        }
        
    }
}

//RANDOM NUMBER FUNCTIONS TAKEN FROM JS MATH.RANDOM WEBSITE DOCUMENTATION
function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}


//get a random unit vector in any dir
function getRandUnitVec(){
    let x = getRandomArbitrary(-1.0, 1.0);
    let y = getRandomArbitrary(-1.0, 1.0);
    let z = getRandomArbitrary(-1.0, 1.0);
    if (x == 0.0 && y == 0.0 && z == 0.0) return glMatrix.vec3.fromValues(1.0, 0.0, 0.0);
    else{
        let vec = glMatrix.vec3.fromValues(x, y ,z);
        glMatrix.vec3.normalize(vec, vec);
        return vec;
    }
}
//get random position in world space (may change later to include range arguments)
function getRandPosition(){
    const bound = 75.0;
    //const bound = 1.0;
    let x = getRandomArbitrary(-bound, bound);
    let y = getRandomArbitrary(-bound, bound);
    let z = getRandomArbitrary(-bound, bound);
    return glMatrix.vec3.fromValues(x, y, z);
}


//INITIALIZATION OF INSTANCE SHADER PROGRAM INFO AND ASTEROID INSTANCED VAOs

function initInstanceShaderInfo(gl, shaderProgram){
    const shaderProgramInfo={
        program: shaderProgram,
        uniformLocations:{
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
            lightSpaceMatrix: gl.getUniformLocation(shaderProgram, "lightSpaceMatrix"),

            //Material Parameters Uniform Locations
            albedoMap: gl.getUniformLocation(shaderProgram, "albedoMap"),
            normalMap: gl.getUniformLocation(shaderProgram, "normalMap"),
            roughness: gl.getUniformLocation(shaderProgram, "roughness"),
            metallic: gl.getUniformLocation(shaderProgram, "metallic"),
            ao: gl.getUniformLocation(shaderProgram, "ao"),
            baseColor: gl.getUniformLocation(shaderProgram, "baseColor"),

            lightDir: gl.getUniformLocation(shaderProgram, "lightDir"),
            camPos: gl.getUniformLocation(shaderProgram, "camPos"),
            shadowMap: gl.getUniformLocation(shaderProgram, "shadowMap"),
        },
        attribLocations: {//Matrix attributes are set to have a specific location (layout) location = x. No need to store that here
            vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
            textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
            normalVec: gl.getAttribLocation(shaderProgram, "aNormal"),
        },

    };
    return shaderProgramInfo;
}

function initInstanceDepthShaderInfo(gl){
    const depthVS = `#version 300 es
    in vec4 aPos;
    layout (location = 2) in mat4 ModelMatrix;
    uniform mat4 lightSpaceMatrix;

    void main(){
        gl_Position = lightSpaceMatrix * ModelMatrix * aPos;
    }
    `
    const depthFS = `#version 300 es
    void main(){
        // gl_FragDepth = gl_FragCoord.z;
    }
    `
    const depthProgram = initShaderProgram(gl, depthVS, depthFS);
    let depthProgramInfo = {
        program: depthProgram,
        vertexPosition: gl.getAttribLocation(depthProgram, "aPos"),
        modelMatrix: gl.getAttribLocation(depthProgram, "ModelMatrix"),
        lightSpaceMatrix: gl.getUniformLocation(depthProgram, "lightSpaceMatrix"),
    }
    return depthProgramInfo;
}

function initInstancedVAO(gl, mesh, instProgInfo, modelMatBuffer, normalMatBuffer, indexOffset){
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let meshbuffer = mesh.buffer;

    //Position Attributes
    let positionSpec = mesh.attributes.position;
    gl.bindBuffer(gl.ARRAY_BUFFER, meshbuffer);
    gl.vertexAttribPointer(
        instProgInfo.attribLocations.vertexPosition, positionSpec.numComponents, positionSpec.type,
        false, positionSpec.byteStride, positionSpec.totalByteOffset
    );
    gl.enableVertexAttribArray(instProgInfo.attribLocations.vertexPosition);

    //Normal Attributes
    let normalSpec = mesh.attributes.normal;
    if (normalSpec != undefined){
        gl.bindBuffer(gl.ARRAY_BUFFER, meshbuffer);
        gl.vertexAttribPointer(
            instProgInfo.attribLocations.normalVec, normalSpec.numComponents, normalSpec.type,
            false, normalSpec.byteStride, normalSpec.totalByteOffset
        );
        gl.enableVertexAttribArray(instProgInfo.attribLocations.normalVec);
    }

    //Material and Texture Attributes
    //see if there is a texture image for this mesh
    if (mesh.material.PBR.TextureIndex != undefined){
        mesh.textureIndex = mesh.material.PBR.TextureIndex;
        let texCoordSpec = mesh.attributes.texture;
        gl.bindBuffer(gl.ARRAY_BUFFER, meshbuffer);
        gl.vertexAttribPointer(
            instProgInfo.attribLocations.textureCoord, texCoordSpec.numComponents, texCoordSpec.type,
            false, texCoordSpec.byteStride, texCoordSpec.totalByteOffset
        );
        gl.enableVertexAttribArray(instProgInfo.attribLocations.textureCoord);
    }

    //MATRIX IN ATTRIBUTES SPECIFICATION
    const modelMatLoc = 3;//location of matrix attributes within the shader
    const normalMatLoc = 7;

    const vec4Size = 16;//4 float32 
    const vec3Size = 12;//3 float32
    const mat4Size = vec4Size * 4;//4 columns vectors
    const mat3Size = vec3Size * 3;//3 column vectors

    const ByteMat4Offset = mat4Size * indexOffset;//skip over the first n matrices
    const ByteMat3Offset = mat3Size * indexOffset;

    //4x4 Matrix Columns initialization
    gl.bindBuffer(gl.ARRAY_BUFFER, modelMatBuffer);
    for (let i = 0; i < 4; ++i){
        gl.enableVertexAttribArray(modelMatLoc + i);
        gl.vertexAttribPointer(modelMatLoc + i, 4, gl.FLOAT, false, mat4Size, ByteMat4Offset + i * vec4Size);
        gl.vertexAttribDivisor(modelMatLoc + i, 1);//set instancing every 1 object
    }

    //3x3 NormalMatrix Columns initialization
    gl.bindBuffer(gl.ARRAY_BUFFER, normalMatBuffer);
    for(let i = 0; i < 3; ++i){
        gl.enableVertexAttribArray(normalMatLoc + i);
        gl.vertexAttribPointer(normalMatLoc + i, 3, gl.FLOAT, false, mat3Size, ByteMat3Offset + i * vec3Size);
        gl.vertexAttribDivisor(normalMatLoc + i, 1);//set instancing every 1 object
    }
    
    //Bind Index Buffer if it exists in the gltf file
    let indexSpec = mesh.attributes.index;
    if (indexSpec != undefined){
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    }

    return vao;
}

function initInstanceDepthVAO(gl, mesh, depthProgInfo, modelMatBuffer, indexOffset){
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let meshbuffer = mesh.buffer;

    //Position Attributes
    let positionSpec = mesh.attributes.position;
    gl.bindBuffer(gl.ARRAY_BUFFER, meshbuffer);
    gl.vertexAttribPointer(
        depthProgInfo.vertexPosition, positionSpec.numComponents, positionSpec.type,
        false, positionSpec.byteStride, positionSpec.totalByteOffset
    );
    gl.enableVertexAttribArray(depthProgInfo.vertexPosition);

    //MATRIX IN ATTRIBUTES SPECIFICATION
    const modelMatLoc = depthProgInfo.modelMatrix;//location of matrix attributes within the shader
    const vec4Size = 16;//4 float32
    const mat4Size = vec4Size * 4;//4 columns vectors
    const ByteMat4Offset = mat4Size * indexOffset;//skip over the first n matrices

    //4x4 Matrix Columns initialization
    gl.bindBuffer(gl.ARRAY_BUFFER, modelMatBuffer);
    for (let i = 0; i < 4; ++i){
        gl.enableVertexAttribArray(modelMatLoc + i);
        gl.vertexAttribPointer(modelMatLoc + i, 4, gl.FLOAT, false, mat4Size, ByteMat4Offset + i * vec4Size);
        gl.vertexAttribDivisor(modelMatLoc + i, 1);//set instancing every 1 object
    }

    
    //Bind Index Buffer if it exists in the gltf file
    let indexSpec = mesh.attributes.index;
    if (indexSpec != undefined){
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    }

    return vao;

}

export {initInstanceShaderInfo, initInstanceDepthShaderInfo};
export{ AsteroidManager };
export{ getRandomInt, getRandomArbitrary};