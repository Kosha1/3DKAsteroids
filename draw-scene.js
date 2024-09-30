var mat4 = glMatrix.mat4; //New version of glMatrix library requires glMatrix before object types

function drawScene(gl, programInfo, vao, texture, camera, cubeRotation) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things
  
  // Clear the canvas before we start drawing on it.
  
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.
    
  const fieldOfView = (45 * Math.PI) / 180; // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  
  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelMatrix = mat4.create();
  
  // Now move the drawing position a bit to where we want to
  // start drawing the square.
  /*
  mat4.translate(
    modelMatrix, // destination matrix
    modelMatrix, // matrix to translate
    //[-0.0, 0.0, 20.0]//-4.0 z
    [10.0, 0.0, -5.0]//-4.0 z
  ); // amount to translate
  */

  mat4.rotate(
    modelMatrix, // destination matrix
    modelMatrix, // matrix to rotate
    cubeRotation, // amount to rotate in radians
    [0, 0, 1],
  ); // axis to rotate around (Z)
  mat4.rotate(
    modelMatrix, // destination matrix
    modelMatrix, // matrix to rotate
    cubeRotation * 0.7, // amount to rotate in radians
    [0, 1, 0],
  ); // axis to rotate around (Y)
  mat4.rotate(
    modelMatrix, // destination matrix
    modelMatrix, // matrix to rotate
    cubeRotation * 0.3, // amount to rotate in radians
    [1, 0, 0],
  ); // axis to rotate around (X)

  mat4.scale(modelMatrix, modelMatrix, [0.5, 0.5, 0.5]);
  //mat4.scale(modelMatrix, modelMatrix, [0.1, 0.1, 0.1]);

  const viewMatrix = mat4.create();
  mat4.translate(viewMatrix, viewMatrix, [0.0, 0.0, -3.0]);
  
      
  // Tell WebGL to use our program when drawing
  gl.useProgram(programInfo.program);
  
  // Set the shader uniforms
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  //gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, camera.getViewMatrix());
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix,false,modelMatrix);

  // Tell WebGL we want to affect texture unit 0
  gl.activeTexture(gl.TEXTURE0);

  // Bind the texture to texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Tell the shader we bound the texture to texture unit 0
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  
  {
    gl.bindVertexArray(vao);
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}
  

function drawSkybox(gl, SkyboxProgInfo, vao, cubemap, camera){
  gl.depthFunc(gl.LEQUAL);
  
  const fieldOfView = (45 * Math.PI) / 180; // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const view3x3 = glMatrix.mat3.create();
  glMatrix.mat3.fromMat4(view3x3, camera.getViewMatrix());

  const view4x4 = glMatrix.mat4.fromValues(view3x3[0], view3x3[1], view3x3[2], 0.0,
                                          view3x3[3], view3x3[4], view3x3[5], 0.0,
                                          view3x3[6], view3x3[7], view3x3[8], 0.0,
                                          0.0, 0.0, 0.0, 1.0);
  
  gl.useProgram(SkyboxProgInfo.program);
  gl.uniformMatrix4fv(SkyboxProgInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(SkyboxProgInfo.uniformLocations.viewMatrix, false, view4x4);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
  gl.uniform1i(SkyboxProgInfo.uniformLocations.samplecube, 0);

  {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }

}
  
  export { drawScene, drawSkybox,};