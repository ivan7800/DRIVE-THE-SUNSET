/** Small route-specific tint and fill-light offsets; weather and time presets stay intact. */
const PALETTES={
 coast:{fill:1.035,fog:[.90,.71,.61]},mountain:{fill:.94,fog:[.65,.73,.78]},
 vineyards:{fill:1.015,fog:[.81,.76,.57]},carmelo:{fill:.96,fog:[.75,.64,.72]}
};
export function routeAtmosphere(route,mood){
 const palette=PALETTES[route]||PALETTES.coast;
 return {...mood,ambient:Math.max(.08,Math.min(.9,mood.ambient*palette.fill)),fog:mood.fog.map((channel,index)=>channel*.92+palette.fog[index]*.08)};
}
