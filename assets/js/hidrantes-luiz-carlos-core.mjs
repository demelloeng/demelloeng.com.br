// Face ranges remain ordered and cover a complete group mesh.
export function elementoDaFace(rows, face) {
  if (!rows.length || !Number.isInteger(face) || face < 0) return null;
  let a=0, b=rows.length-1;
  while(a<b) { const m=(a+b+1)>>1; if(rows[m][2]<=face) a=m; else b=m-1; }
  const row=rows[a];
  return face>=row[2] && face<row[2]+row[3] ? row : null;
}
export function primeiroHitVisivel(hits) {
  return hits.find(hit => hit.point.y <= hit.object.userData.cut + 1e-6) || null;
}
