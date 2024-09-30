
class Mesh{

    vao;
    indexDraw = false;

    constructor(glContext, meshbuffer, indexBuff, shaderProgramInfo, depthInfo,
                transform, attributeInfo, materialInfo, gltextures){

        this.gl = glContext;
        this.buffer = meshbuffer;
        this.indexBuffer = indexBuff;//duplicate of buffer since WebGL can't bind 1 buffer to Element and Array binding points 

        this.transformMatrix = transform;
        this.programInfo = shaderProgramInfo;
        this.depthInfo = depthInfo;

        this.attributes = attributeInfo;

        this.material = materialInfo;
        this.textures = gltextures;

        this.drawMode = attributeInfo.drawMode;

        this.max = attributeInfo.position.max;
        this.min = attributeInfo.position.min;


        this.textureIndex = -1;//-1 defualt means no texture to be drawn
        this.initVAO(attributeInfo);
        this.initDepthVAO(attributeInfo);

    }

    initVAO(attributes){
        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);

        //Position Attributes
        let positionSpec = attributes.position;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.vertexAttribPointer(
            this.programInfo.attribLocations.vertexPosition, positionSpec.numComponents, positionSpec.type,
            false, positionSpec.byteStride, positionSpec.totalByteOffset
        );
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

        //Normal Attributes
        let normalSpec = attributes.normal;
        if (normalSpec != undefined){
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
            this.gl.vertexAttribPointer(
                this.programInfo.attribLocations.normalVec, normalSpec.numComponents, normalSpec.type,
                false, normalSpec.byteStride, normalSpec.totalByteOffset
            );
            this.gl.enableVertexAttribArray(this.programInfo.attribLocations.normalVec);
        }

        //Material and Texture Attributes
        //see if there is a texture image for this mesh
        if (this.material.PBR.TextureIndex != undefined){
            this.textureIndex = this.material.PBR.TextureIndex;
            let texCoordSpec = attributes.texture;
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
            this.gl.vertexAttribPointer(
                this.programInfo.attribLocations.textureCoord, texCoordSpec.numComponents, texCoordSpec.type,
                false, texCoordSpec.byteStride, texCoordSpec.totalByteOffset
            );
            this.gl.enableVertexAttribArray(this.programInfo.attribLocations.textureCoord);
        }

        //Bind Index Buffer if it exists in the gltf file
        let indexSpec = attributes.index;
        if (indexSpec != undefined){
            this.indexDraw = true;
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        }

        this.gl.bindVertexArray(null);
    }
    initDepthVAO(attributes){
        this.depthvao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.depthvao);

        //Position Attributes
        let positionSpec = attributes.position;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.vertexAttribPointer(
            this.depthInfo.vertexPosition, positionSpec.numComponents, positionSpec.type,
            false, positionSpec.byteStride, positionSpec.totalByteOffset
        );
        this.gl.enableVertexAttribArray(this.depthInfo.vertexPosition);

        //Bind Index Buffer if it exists in the gltf file
        let indexSpec = attributes.index;
        if (indexSpec != undefined){
            this.indexDraw = true;
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        }

        this.gl.bindVertexArray(null);
    }

    draw(modelTransformMatrix){
        this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.meshMatrix, false, this.transformMatrix);


        //Build the normal Matrix and put it into uniform in shader
        const fullMeshTransform = glMatrix.mat4.create();
        glMatrix.mat4.multiply(fullMeshTransform, modelTransformMatrix, this.transformMatrix);//Model*Mesh for actual world trans
        const normalMatrix = glMatrix.mat3.create();
        glMatrix.mat3.normalFromMat4(normalMatrix, fullMeshTransform);
        this.gl.uniformMatrix3fv(this.programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        {

            this.gl.bindVertexArray(this.vao);

            //general material parameter uniform bindings
            this.gl.uniform4fv(this.programInfo.uniformLocations.baseColor, this.material.PBR.colorFactor);
            this.gl.uniform1f(this.programInfo.uniformLocations.metallic, this.material.PBR.metallicFactor);
            this.gl.uniform1f(this.programInfo.uniformLocations.roughness, this.material.PBR.roughnessFactor);
            this.gl.uniform1f(this.programInfo.uniformLocations.ao, 1.0);//ao can be optionally supplied as a texture only


            if (this.indexDraw){
                
                if (this.textureIndex != -1){//attach a texture
                    //console.log("Texture active")
                    this.gl.activeTexture(this.gl.TEXTURE0);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.textureIndex + 2]);
                    this.gl.uniform1i(this.programInfo.uniformLocations.albedoMap, 0);

                    if(this.material.normalTexIndex != undefined){//normal map present
                        
                        this.gl.activeTexture(this.gl.TEXTURE1);
                        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.material.normalTexIndex + 2]);
                        this.gl.uniform1i(this.programInfo.uniformLocations.normalMap, 1);
                        if(this.material.normalTexCoordsIndex != 0){
                            console.log("Normal Tex Coords not same as albedo (image) texcoords");
                        }
                    
                    }
                    
                }
                else {
                    //console.log("No Texture active")
                    this.gl.activeTexture(this.gl.TEXTURE2);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0]);
                    this.gl.uniform1i(this.programInfo.uniformLocations.albedoMap, 2);

                    this.gl.activeTexture(this.gl.TEXTURE1);
                    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
                    this.gl.uniform1i(this.programInfo.uniformLocations.normalMap, 1);


                }
                                
                const vertexCount = this.attributes.index.count;
                const offset = this.attributes.index.totalByteOffset;
                const type = this.attributes.index.type;
                this.gl.drawElements(this.drawMode, vertexCount, type, offset);
                
            }
            else console.log("Some Mesh Doesn't have index draw");

            this.gl.bindVertexArray(null);
        }
    }
    renderDepth(){
        this.gl.uniformMatrix4fv(this.depthInfo.meshMatrix, false, this.transformMatrix);
        {
            this.gl.bindVertexArray(this.depthvao);
            if (this.indexDraw){
                const vertexCount = this.attributes.index.count;
                const offset = this.attributes.index.totalByteOffset;
                const type = this.attributes.index.type;
                this.gl.drawElements(this.drawMode, vertexCount, type, offset);
            }
            this.gl.bindVertexArray(null);
        }
    }

}

export {Mesh};