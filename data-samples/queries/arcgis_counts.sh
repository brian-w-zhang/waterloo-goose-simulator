G='geometry=-80.5580,43.4650,-80.5370,43.4780&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects'
B=https://gis.waterloo.ca/maps/rest/services/Public
for p in "Public_Base/MapServer/3" "Public_Base/MapServer/2" "Public_Base/MapServer/21" "Public_Base/MapServer/17" "Public_Base/MapServer/18" "Public_Base/MapServer/23" "Public_Base/MapServer/12" "Public_Base/MapServer/6" "Public_Operations/MapServer/2" "Public_Operations/MapServer/3" "Public_Operations/MapServer/24" "Public_Operations/MapServer/25" "Public_Operations/MapServer/29" "Public_Operations/MapServer/31" "Public_Operations/MapServer/34" "Public_Operations/MapServer/20" "Public_Operations/MapServer/22" "Public_Forestry_Mobile/MapServer/0" "Public_Forestry_Mobile/MapServer/1"; do
 c=$(curl -s -m 60 "$B/$p/query?where=1%3D1&$G&returnCountOnly=true&f=json")
 echo "$p $c"
done
