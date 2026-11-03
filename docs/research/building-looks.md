# University of Waterloo main campus: what the buildings look like

Research for the flat-colour toon model. Each entry comes from photos I actually looked at: Wikimedia Commons originals, uwaterloo.ca news images, and Google Images result grids. Hex values are approximate daylight colours. Most were picked by eye and some were checked with a median-pixel sample from Commons photos. Treat them as palette starting points, not measurements. I downloaded nothing into the repo. Machine-readable version: `building-looks.json` (same data; `roof_hex` is `null` where I never saw the roof from above).

**How confident to be:** *high* means several clear exterior photos agree. *medium* means one good photo, or several thumbnails. *low* means I only saw thumbnails, or could not identify the building for certain, so don't trust the description.

## Headline findings

- **Davis Centre is neither brick nor concrete.** It is a long glass vault with a curved top and a green/teal tint. Teal ducts arch over the curved glass, there are red-painted steel portal frames at the entrances, and the low side wings are beige precast with horizontal metal bands.
- **Hagey Hall is brick, not concrete.** It is warm mid-brown brick. The Humanities Theatre fly tower is a huge, almost windowless brown-brick block. The newer SAF wing uses darker purple-brown brick with taupe metal panels and glass.
- **QNC has no copper.** It is reflective silver-blue glass with vertical fins, a glass cube wrapped in a hexagonal "honeycomb" frame, and a dark charcoal brick base with a white band above it.
- **MC** is raw grey fluted concrete, brutalist, sitting on piers. Its tall blank stair towers are where the pink tie hangs.
- **Dana Porter (LIB)** is a white/cream cube of vertical precast fins. It sits on a dark brown band above a cream podium whose ground floor has arched openings.
- **E5 and E7** use silver faceted ("pleated" diamond-pattern) metal panels with glass. **E6** is a dark navy glass-and-panel grid. **EV3** has grey panels with lime-green horizontal stripes.
- **Brick colour falls into three families.** Toon materials can be shared on that basis:
  - buff/tan: DWE, CPH, PHY, EIT
  - mid-brown: HH, ML, PAC, SCH
  - red-brown: V1, REV, MKV, TC, NH, E2, CLV, M3. M3, CMH and RCH lean orange.
- **Grad House** is a white 19th-century farmhouse with brown shutters and a brown hip roof. It is the odd one out on campus.

## Building table

| Code | Dominant wall | Hex | Secondary | Windows | Roof hex | Distinctive features | Conf. | Sources |
|---|---|---|---|---|---|---|---|---|
| DC | Glass curtain wall, green/teal-tinted, on a long barrel-vaulted (curved-top) form | `#4e6f72` | Low wings in beige/tan precast panels with horizontal metal banding (#a69c90); silver corrugated metal panel walls; bright red painted steel portal frames at entrances; teal-grey ductwork 'elbows' arching over the vault | curtain | `#8c9294` | Not brick, not concrete: a high-tech 1988 glass vault. Big teal ducts loop over the curved glass roof edge; red steel frames/columns at the plaza entrances. Plaza in front is red-brown/grey interlocking brick pavers. | high | [1](https://commons.wikimedia.org/wiki/File:Davis_Centre_(University_of_Waterloo)_-_Waterloo,_ON.jpg) [2](https://commons.wikimedia.org/wiki/File:UW_Davis_Centre.jpg) [3](https://uwaterloo.ca/news/10-waterloo-landmarks-shape-student-experience) |
| MC | Raw board-marked / finely fluted grey concrete, brutalist | `#9a9c92` | Small amount of brown brick infill at ground level; dark window frames | ribbon | `#8a8a86` | 1968 brutalist block on pilotis: upper floors cantilever over a recessed ground floor on heavy concrete piers; tall blank windowless concrete stair/service towers (where the giant pink tie is hung); upper floors have repetitive small vertical window openings with concrete fins forming continuous bands. | high | [1](https://commons.wikimedia.org/wiki/File:WaterlooMathBuilding.jpg) [2](https://commons.wikimedia.org/wiki/File:UW-MathFaculty-PinkTie.jpg) |
| M3 | Red-orange brick end walls | `#a85d3f` | Curtain wall in a checker of pale teal/aqua, clear and dark-blue glass panels with silver mullions; white top band/parapet | curtain | `#d0d0cc` | 2018 4-storey box: brick 'bookend' piers framing a large mixed-tint glass grid centre facade; glazed bridge to MC; narrow vertical glass slots on the brick returns. | high | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Math_3.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Mathematics_3.jpg) |
| QNC | Reflective silver/blue glass curtain wall with vertical mullion fins | `#7a8ca0` | Base podium of dark charcoal/grey brick in mixed tones (#4f4f4f); white/light grey panel band above the podium | curtain | `#bfc3c6` | 2012. Two volumes: a long glass bar with strong vertical fins cantilevering over the entrance, plus a glass cube clad in a hexagonal 'honeycomb' frame. Ground-floor accents in orange-red. NOT copper - no copper panels seen in any photo. | high | [1](https://commons.wikimedia.org/wiki/File:Quantum_Nano_Center_UW_2013.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Quantum-Nano_Center.jpg) |
| SLC | Curved blue glass ribbon facade (courtyard side) with grey metal spandrel bands | `#5f7f9e` | Red-brown brick end pavilions (#8b5a40); buff split-face concrete block piers carrying a brown timber pergola; grey metal siding upper level. 2020s SLC/PAC expansion: green-tinted glass with vertical fins over white precast columns | mixed | `#8a8a86` | Crescent-shaped courtyard facade wrapping a paved plaza with picnic tables; pergola walkways. The new expansion on the PAC side is a glass box on a white colonnade. | medium | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Student_Life_Center.jpg) [2](https://commons.wikimedia.org/wiki/File:Student_Life_Centre_Courtyard_at_the_University_of_Waterloo_in_August_2007.jpg) [3](https://uwaterloo.ca/news/10-waterloo-landmarks-shape-student-experience) |
| PAC | Medium brown brick | `#7d5a43` | Dark grey/charcoal sloped metal roofs and fascias; 2020s expansion in glass curtain wall + grey metal panels with black Warriors logo | punched | `#d6d6d2` | 1970 sports complex: large flat white membrane roof over the main gym ringed by lower dark-grey sloped/stepped roofs; gabled clerestory entrance pavilion in brown brick; few windows on the old part. | medium | [1](https://www.google.com/search?udm=2&q=Physical+Activities+Complex+PAC+University+of+Waterloo+exterior) [2](https://athletics.uwaterloo.ca) |
| LIB | White/cream precast concrete fins (vertical ribs) on the tower | `#d0cbc1` | Dark brown fascia band between tower and podium (#5a4636); podium in cream precast with a band of round-arched glazing at ground level | slot | n/a | Dana Porter 'sugar cube': 10-storey near-cubic tower with closely spaced vertical precast fins and narrow vertical window slots, sitting on a wider 2-storey podium; the tower overhangs on a recessed dark band. Ground floor has distinctive arched (vaulted) openings. | high | [1](https://commons.wikimedia.org/wiki/File:Dana_Porter_Library_2.jpg) [2](https://commons.wikimedia.org/wiki/File:Dana_Porter_Library_-_Waterloo,_ON.jpg) |
| HH | Brown brick (warm mid-brown) | `#8a6650` | SAF wing (2010s): darker purple-brown brick (#6f5848), taupe/bronze metal panels, glass curtain wall at entrance | punched | n/a | Brick, not concrete. The Humanities Theatre fly tower is a huge nearly windowless brown-brick block with a clerestory strip at the top. The newer School of Accounting & Finance addition has horizontal strip windows set in brick and a full-glass upper storey. | high | [1](https://commons.wikimedia.org/wiki/File:Hagey_Hall_of_the_Humanities_(University_of_Waterloo)_-_Waterloo,_ON.jpg) [2](https://commons.wikimedia.org/wiki/File:UW_SAF.JPG) |
| ML | Mid-brown brick (multi-tone) | `#8c6a52` | Concrete/precast trim and stair; grey window frames | slot | n/a | Long low brick walls animated by tall narrow angled vertical window slots (vertical strip windows); faces the Arts Quad. Theatre of the Arts inside. | medium | [1](https://www.google.com/search?udm=2&q=Modern+Languages+building+uwaterloo+ML+exterior+brick) [2](https://uwaterloo.ca/germanic-slavic-studies) |
| E5 | Silver/light grey faceted (pleated, diamond-pattern) metal panel cladding | `#b8bec4` | Horizontal glass ribbon bands; dark charcoal metal-clad base volume; glazed bridge to E7/DC across Ring Road | ribbon | n/a | 2011 6-storey box with prismatic shimmering silver panels in a zig-zag pattern; long glazed pedestrian bridge. | high | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Engineering_5_Building.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_-_Engineering_V.jpg) |
| E6 | Dark navy/charcoal glass and panel grid | `#2f4566` | Dark grey metal panels | mixed | n/a | Dark blue-black facade of glass and opaque panels in a staggered/random rhythm of window sizes; reads as a dark monolith next to E5. | medium | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Engineering_6_Building_Exterier.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_E5_%26_E6_(20317885245).jpg) |
| E7 | Clear/teal-tinted glass curtain wall | `#8fb0b0` | White/silver pleated (faceted) metal panels similar to E5; round raw-concrete columns | curtain | n/a | 2018, renamed Pearl Sullivan Engineering Building. Large glass mass with a deep overhang on cylindrical concrete columns at the entrance; faceted white panel sections; red stairs visible through glass in the atrium. | medium | [1](https://www.google.com/search?udm=2&q=Pearl+Sullivan+Engineering+Building+E7+Waterloo+exterior) [2](https://uwaterloo.ca/news/10-waterloo-landmarks-shape-student-experience) |
| EIT | Beige/buff brick | `#c4ab88` | Light blue-green glass curtain wall sections, white/silver metal panels and sunshades | mixed | n/a | 2003 Teeple Architects. Crisp modernist blocks of buff brick with large glazed corners and projecting glass bays. | medium | [1](https://www.google.com/search?udm=2&q=Centre+for+Environmental+and+Information+Technology+EIT+University+of+Waterloo+building+exterior) [2](https://www.instagram.com/teeplearchitects) |
| STC | Glass curtain wall + red-brown brick | `#8a5440` | Dark grey/charcoal metal panels; glazed bridges | mixed | n/a | 2021 Science Teaching Complex: glass and brick, bridged to neighbouring science buildings; blue interior accents visible through glass. | low | [1](https://www.google.com/search?udm=2&q=Science+Teaching+Complex+STC+University+of+Waterloo) |
| EV1 | Buff/tan brick (low confidence) | `#b49a78` | Concrete | punched | n/a | 1970s Environment 1; not clearly identified in photos I could view. Interior atrium shows buff brick and raw concrete. | low | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Center_of_Environmental_and_Information_Technology_TA_lounge.jpg) |
| EV2 | Red-brown brick (low confidence) | `#8b4a38` | Concrete columns | punched | n/a | Low brick building adjacent to EV3; a Commons view near EV3 shows a 2-storey red-brick block next to the lime/grey EV3 cladding, which is probably EV2/EV1. | low | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_campus_-a.jpg) |
| EV3 | Light grey/taupe and dark grey rainscreen panels with lime-green horizontal stripes | `#9a968a` | Glass ribbon windows; lime-green canopies/soffits (#b5d334) | ribbon | `#5b6e86` | 2011 LEED Platinum. Strong horizontal banding of lime green; roof largely covered in solar panels plus green roof (reads blue-grey from above). | high | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Environmental_Building_3_Exterior.jpg) [2](https://commons.wikimedia.org/wiki/File:Environment_3_University_of_Waterloo.jpg) |
| V1 | Red-brown brick | `#8a4a36` | Grey concrete paver roof terraces; brown/dark window frames | punched | `#6e6e6a` | Village 1 (1965): central complex plus clusters of 2-3 storey flat-roofed brick 'houses' around green courtyards connected by paths. Some green roofs on the central building. | medium | [1](https://www.google.com/search?udm=2&q=Village+1+residence+University+of+Waterloo+exterior) [2](https://commons.wikimedia.org/wiki/File:On_the_roof_of_Village_1_at_the_University_of_Waterloo,_June_2007.jpg) |
| REV | Red-brown brick | `#8a4c38` | Silver/grey aluminium entrance pavilion; window/spandrel bands | ribbon | n/a | 3-4 storey brick residence wings with long horizontal window rows; formerly 'Village 2'. | medium | [1](https://commons.wikimedia.org/wiki/File:Entrance_to_Ron_Eydt_Village_(4773822393).jpg) [2](https://www.google.com/search?udm=2&q=Ron+Eydt+Village+REV+Waterloo+exterior) |
| PHY | Buff/tan brick (yellowish-brown) | `#a99a7c` | Concrete trim; dark window frames | ribbon | n/a | 1960s 4-storey long slab with dense horizontal rows of windows (punched windows reading as bands); a small white observatory dome on the roof. | medium | [1](https://commons.wikimedia.org/wiki/File:Physics_Building_University_of_Waterloo_Fall_2012.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Physics_Building_Greens.jpg) |
| CPH | Buff/tan brick | `#b0895f` | Concrete; brick planters with red-painted wooden benches | ribbon | n/a | Carl Pollock Hall: low buff-brick engineering block, outdoor seating terrace with pergola. | medium | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Carl_Pollock_Hall_Outside_Seating_area.jpg) |
| B1 | Unknown - likely 1960s concrete/precast with brick (not verified) | `#a09a8e` | Greenhouse (glass) on/near B1 | ribbon | n/a | Could not find a clearly labelled exterior photo. A university Biology page shows a concrete building raised on pilotis with a window grid, probably B1/B2. | low | [1](https://www.google.com/search?udm=2&q=Biology+1+Biology+2+building+University+of+Waterloo+exterior) |
| B2 | Unknown - likely precast concrete/brick (not verified) | `#a09a8e` | - | ribbon | n/a | No reliable exterior photo found. | low | [1](https://www.google.com/search?udm=2&q=Biology+1+Biology+2+building+University+of+Waterloo+exterior) |
| C2 | Unknown - likely 1960s precast concrete/buff brick (not verified) | `#a39d90` | - | ribbon | n/a | No reliable exterior photo found. | low | [1](https://www.google.com/search?udm=2&q=Chemistry+2+C2+Earth+Sciences+Chemistry+ESC+building+University+of+Waterloo) |
| ESC | Grey precast concrete (1960s) | `#9e9a90` | Raw concrete columns; rooftop lab mechanical units | ribbon | n/a | 3-storey block with continuous horizontal window bands (archival department-history photo); 2024 photos show raw concrete column/beam details at the entrance. | low | [1](https://www.google.com/search?udm=2&q=Earth+Sciences+and+Chemistry+building+uwaterloo+exterior) |
| NH | Dark red-brown brick (original); orange-red brick on 2015 expansion | `#7e4a36` | Expansion: glass curtain wall, white/silver metal panels, glazed bridge | mixed | n/a | Original 1970s Needles Hall is a chunky stepped brick block; the 2015 expansion adds a brighter orange-red brick volume with large glass sections and a bridge. | medium | [1](https://www.google.com/search?udm=2&q=Needles+Hall+University+of+Waterloo+exterior) [2](https://uwaterloo.ca/accessability-services) |
| DWE | Buff/tan brick with darker speckled bricks | `#b49d87` | Concrete band courses; aluminium windows; black canopy | punched | n/a | Douglas Wright Engineering: plain 1950s-60s buff brick block with grouped window panels. | high | [1](https://commons.wikimedia.org/wiki/File:Douglas_Wright_Engineering_Building_UWaterloo.jpg) |
| E2 | Red-brown brick | `#8b4c3a` | Dark navy/charcoal metal fascia band; glass entrance additions | punched | n/a | Low red-brick engineering building with a dark metal roof band; newer glazed entrance. | low | [1](https://www.google.com/search?udm=2&q=uwaterloo+E2+Engineering+2+building+brick) |
| E3 | Unknown exterior; interior bay is raw concrete | `#9a9890` | Silver corrugated metal siding and buff split-face block on adjacent lab wing (ECH) | mixed | n/a | Commons interior photo shows raw concrete columns and perforated concrete balcony fronts with red/yellow steel. Exterior not verified. | low | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Engineering_Building_3,_September_2009.jpg) [2](https://commons.wikimedia.org/wiki/File:ECH_with_E6_Jan_2012.jpg) |
| RCH | Orange-brown brick (renovated) | `#a5674a` | Grey metal panels, glazing | mixed | n/a | J.R. Coutts Engineering Lecture Hall; 2009 Daily Bulletin photo shows brick with modern glazed additions. Low confidence on details. | low | [1](https://www.google.com/search?udm=2&q=Rod+Coutts+Hall+RCH+Waterloo+building) |
| AL | Light grey/white concrete with vertical blade walls/fins | `#bfbcb4` | Dark brown brick base; dark glazing | slot | n/a | Arts Lecture Hall: monumental, fortress-like; repetitive vertical concrete fins (an Instagram architecture post compares it to ancient Egyptian buildings); faces Dana Porter across the Arts Quad, wide concrete steps. | medium | [1](https://www.google.com/search?udm=2&q=Arts+Lecture+Hall+uwaterloo+exterior) |
| PAS | Grey concrete, brutalist | `#acaead` | Brown brick tower/stair volumes (#7a5a48); recessed dark window bands | ribbon | n/a | Stepped/terraced 1960s brutalist block with deep horizontal window bands and concrete spandrels; brick towers at one end. | high | [1](https://commons.wikimedia.org/wiki/File:Psychology,_Antropology,_Sociology_Building_at_uwaterloo.jpg) |
| TC | Deep red-brown brick | `#7a3a2e` | Glass curtain wall corner/entrance volumes; dark metal | mixed | n/a | Tatham Centre (2002): long 3-storey block with a dark red brick main facade, strip windows, and fully glazed end/entrance pavilions. | high | [1](https://commons.wikimedia.org/wiki/File:TC_01.jpg) [2](https://commons.wikimedia.org/wiki/File:Tatham_Centre_UWaterloo.jpg) |
| GSC | Brown/red-brown brick | `#7e5440` | Tall brown brick smokestack (heating plant) | punched | n/a | General Services Complex: low utilitarian brick buildings with the campus's tall brick chimney, a landmark. | medium | [1](https://www.google.com/search?udm=2&q=South+Campus+Hall+OR+General+Services+Complex+University+of+Waterloo) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Smokestack.jpg) |
| SCH | Brown brick lower storeys | `#7f5a44` | White/light concrete upper bands and parapets | ribbon | n/a | South Campus Hall: stepped, terraced massing with white horizontal bands over brown brick; faces University Ave entrance. | medium | [1](https://commons.wikimedia.org/wiki/File:Panorama_UW_south_campus_hall.jpg) [2](https://www.google.com/search?udm=2&q=South+Campus+Hall+OR+General+Services+Complex+University+of+Waterloo) |
| TJB | Blue-tinted glass curtain wall | `#4f7fae` | White/silver metal panels | curtain | n/a | Toby Jenkins Applied Health Research Building: glass box with white panel frame; signage on a white band. | low | [1](https://www.google.com/search?udm=2&q=Burt+Matthews+Hall+OR+Lyle+Hallman+OR+Toby+Jenkins+University+of+Waterloo+building) |
| BMH | Red-brown/orange brick (not verified per building) | `#9a5f45` | Glass, blue/grey panels | punched | n/a | Applied Health Sciences complex (BMH/LHI/LHN); thumbnails show brick and glass; could not separate buildings with confidence. | low | [1](https://www.google.com/search?udm=2&q=Burt+Matthews+Hall+OR+Lyle+Hallman+OR+Toby+Jenkins+University+of+Waterloo+building) |
| LHI | Red-brown brick with glass (not verified) | `#94563f` | Glass curtain wall, blue/grey panels | mixed | n/a | Lyle Hallman Institute; see BMH note. | low | [1](https://www.google.com/search?udm=2&q=Burt+Matthews+Hall+OR+Lyle+Hallman+OR+Toby+Jenkins+University+of+Waterloo+building) |
| MKV | Red-brown brick | `#7a4a36` | Grey/white precast panels; rounded glazed stair tower | punched | n/a | Mackenzie King Village: 4-5 storey brick residence with light precast bays and a cylindrical stair tower. | medium | [1](https://commons.wikimedia.org/wiki/File:Mackenzie_King_Village.jpg) |
| UWP | Light buff/greyish brick (towers); buff/cream brick low courts | `#b8ab95` | Concrete balconies | punched | n/a | UW Place: ~11-12 storey slab towers (Beck/Eby halls etc.) plus low-rise courtyard buildings (Wellesley, Waterloo, Woolwich Courts). | low | [1](https://www.google.com/search?udm=2&q=UW+Place+residence+Waterloo+building+exterior) |
| CLV | Red-brown brick ground floor | `#8f4e3a` | Beige/grey vinyl siding upper floors; grey asphalt shingle pitched roofs | punched | `#6b6b6b` | Columbia Lake Village: suburban 2-storey townhouse rows with pitched roofs. | medium | [1](https://www.google.com/search?udm=2&q=Columbia+Lake+Village+Waterloo+townhouses) |
| CMH | Orange-red/brown brick high-rise | `#a3593e` | Darker brick accent bands; white/silver metal and glass base | punched | n/a | Claudette Millar Hall: ~16-18 storey brick residence tower (Masri O Architects) on a glazed podium. | medium | [1](https://www.google.com/search?udm=2&q=Claudette+Millar+Hall+Waterloo) |
| FED | Dark brown brick | `#6d4a38` | Grey roof, some timber | punched | n/a | Federation Hall: low 1-storey brick hall with sloped roof sections near Ring Road. Low confidence on details. | low | [1](https://www.google.com/search?udm=2&q=Federation+Hall+University+of+Waterloo+building+exterior) |
| GH | White stucco/painted farmhouse | `#e8e6e0` | Dark brown hip roof shingles, brown shutters and wooden porch | punched | `#5b4a42` | Graduate House: 19th-century 2-storey farmhouse (white walls, brown shutters, arched ground-floor window) - stands out completely from the modern campus. | high | [1](https://commons.wikimedia.org/wiki/File:UWaterloo_-_Graduate_House.JPG) [2](https://commons.wikimedia.org/wiki/File:Grad_House_UWaterloo.jpg) |
| UC | Brown/red-brown brick | `#82513d` | Dark trim | punched | n/a | University Club: low single-storey brick building near Village 1. | low | [1](https://www.google.com/search?udm=2&q=University+Club+University+of+Waterloo+building) |
| OPT | Tan/pinkish buff brick (original block) | `#b08a70` | 2009 addition: white/silver metal panels with horizontal frosted/blue glass bands; new Waterloo Eye Institute (2020s) in dark charcoal metal | mixed | n/a | Original 2-3 storey brick block with horizontal windows, extended by a long sleek white horizontal-banded wing. | medium | [1](https://www.google.com/search?udm=2&q=University+of+Waterloo+School+of+Optometry+building+exterior) |
| CIF | Red-brown brick and white/grey metal siding | `#8b5340` | Red-painted steel structure/canopies; 2023 Field House in grey metal with a huge gold/yellow (#f2b70f) panel and black Warrior logo | punched | n/a | Columbia Icefield: low arena/gym complex, large flat roofs; field house addition is a big grey shed with gold branding. | medium | [1](https://commons.wikimedia.org/wiki/File:CIF_01.jpg) [2](https://www.google.com/search?udm=2&q=Columbia+Icefield+University+of+Waterloo+building+exterior) |
| ION_UW | Station tower clad in checker panels of navy, grey-green and white glass | `#45556e` | Glass and steel canopy shelters with dark grey frames; concrete platform with yellow tactile edge | curtain | `#3a3a3a` | University of Waterloo ION LRT station on the rail corridor beside E5/E7 and DC; single sign tower with ION and GRT logos. | high | [1](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Station_Nov_2017.jpg) [2](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Station_(46593200905).jpg) |

## Roofs (seen from above)

The aerial view I used is a University of Waterloo Athletics drone photo looking north over PAC, SLC, MC, QNC, DC and M3 (seen via Google Images). From it and other aerial thumbnails:
- Most flat roofs are mid-grey membrane or gravel (`#8a8a86`). A few big-span roofs are white or very light (`#d6d6d2`): the PAC main gym, M3, and parts of QNC.
- PAC: white flat roof over the main gym, ringed by dark charcoal sloped and stepped roofs.
- DC: the curved vault reads as blue-grey glass and metal (`#8c9294`).
- EV3: covered in solar panels plus a green roof, so it reads blue-grey and green.
- V1 houses: dark grey flat roofs, some green roofs, and grey concrete paver terraces on the central building.
- CLV townhouses and Grad House have pitched roofs with dark grey or brown shingles.
- The JSON leaves `roof_hex` null for every building whose roof I did not actually see. A generic `#8a8a86` is a safe default for them.

## Ground surfaces

- **Ring Road:** ordinary dark grey asphalt with a yellow centre line. Sidewalks along it are grey poured concrete (`#b5b2ab`). Main campus walkways are mostly poured concrete too.
- **Entrance plazas:** interlocking brick pavers. In front of DC they are red-brown and grey (`#9a7a6a` / `#8a8580`). Pavers also show up on the MC/DC side walkways and in front of Tatham. Concrete-paver paths with brick borders appear around the Arts buildings.
- **Arts Quad** (between Dana Porter, Arts Lecture and ML): a large light grey concrete plaza (`#bdbab3`). Since the recent renovation it has painted yellow "circuit-trace" lines, a pale green painted area, raised planters and picnic tables. There was also a rainbow crosswalk stripe at the time of the uwaterloo news photo.
- **SLC courtyard:** grey concrete pavers with darker grey banding.
- **Wooded areas** (behind the Arts buildings): asphalt or packed-gravel footpaths through mulched beds.
- **MC/DC green and South Campus green:** open mown lawns (`#6f9a48` in summer) crossed by concrete paths, with scattered trees.

## Street furniture

- **Benches:**
  - wood slats with dark grey metal frames and armrests (seen at the bus and ION area)
  - red-painted wooden bench tops on brick or concrete planter walls (CPH terrace)
  - brown timber benches and picnic tables (SLC courtyard)
  - metal picnic tables in the Arts Quad
- **Waste bins:** the campus standard is a black multi-stream station, a black box with 2-4 openings, each with a coloured label: blue for containers/recycling, green for organics or paper, black for landfill. These are the Plant Operations "Receptacle Standard" models, and they appear both indoors and outdoors.
- **Light poles:** dark grey or black poles with single drum or "acorn"-style heads. Black wayfinding totems carry a gold UW crest.
- **Hard to miss:** the big black "UNIVERSITY OF WATERLOO" letter sign with yellow umbrellas near Dana Porter, and yellow parking gates and ticket machines.

## Trees

- Photos consistently show a mix of **deciduous shade trees** (maples dominate; Norway, sugar and silver maples, with orange/red autumn colour in several shots) and **conifers** (white pine, blue/white spruce and Austrian pine). The conifers are often clustered in groups near DC, the Ring Road edges and the Arts area.
- Honey locusts and other small ornamental trees line some plazas and the SLC area. Weeping willows appear near the ponds and Laurel Creek.
- For a toon model: roughly 60-70% round deciduous trees (`#5f8f3e`, or `#d9822b` in autumn) and 30-40% cone-shaped conifers (`#2f5a3a`).
- This split is an impression from about 20 photos, not a survey.

## Caveats

- **No usable exterior photo, so these entries are guesses:** B1, B2, C2, E3, EV1, BMH and LHI. Treat their entries as placeholders and check them on Mapillary or Street View before relying on them.
- **Older photos:** SLC, PAC and Optometry have had large recent additions (SLC/PAC expansion in the 2020s, Waterloo Eye Institute). Commons photos from before about 2015 show the older state.
- **Mapillary:** I could not use it, because its API needs a token.

## Second pass (Nov 3, 2026)

This pass rechecks the low-confidence buildings above, plus two specific questions. Evidence comes from Google Street View panoramas (2014, 2019 and 2025 captures), Google Images previews, Wikimedia Commons originals, and Esri World Imagery aerial tiles. To decide which building a Street View facade belongs to, I checked the camera position and heading against the OSM footprints in `data/raw/osm/`. I downloaded nothing into the repo. Machine-readable version: `building-looks-pass2.json`.

**How the hexes were made:** where a hex says "sampled", it is a pixel median from the photo. The recommended `wall_hex` is lifted a little, because many of the Street View captures are shaded or overcast.

### Specific questions

1. **MC is light warm-grey precast concrete, not brown or tan.**
   - It looks tan only in golden-hour photos. Commons `UWaterloo_MC.jpg` samples `#c49756` at sunset.
   - Midday photos are grey: the MC/DC courtyard shot samples `#a7a3a2` and a sunlit close-up `#bebfb8`.
   - OSM also tags MC as concrete / lightgrey.
   - Recommended colour: `#aeaba3`. Ground-floor infill is brown brick.
2. **Roofs in the MC / DC / C2 / ESC / B1 / B2 area are mostly mid warm-grey gravel or ballast.** None are black, and few are white.
   - Esri medians over the OSM footprints:
     - MC `#847c72`
     - C2 `#84776e`
     - B2 `#8d8077`
     - B1 `#948b7c`
     - E2/E3 `#756a68`/`#7a7468`
   - Lighter exceptions:
     - STC `#b9bab5`
     - ESC `#cec4ba`
     - QNC: a green roof plus light grey (`#a49a8e`)
   - DC is grey with blue-teal skylight strips along the vault.
   - Google's 2026 satellite view agrees: everything reads as mid grey.
   - Suggested defaults: `#857d74` for gravel roofs, `#c0bfb8` for the light roofs.
   - The Esri imagery is from about 2016-17 (M3 is still under construction in it).

### Building table (pass 2)

| Code | Dominant wall | Hex | Windows | Conf. | Sources |
|---|---|---|---|---|---|
| B1 | Buff/tan brick, 1960s. Glass Plant Growth Facility greenhouses on a grey concrete plinth along the south side | `#b59a7c` | punched | medium | [1](https://commons.wikimedia.org/wiki/File:BIO_Greenhouse.jpg) [2](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.47082,-80.54275&heading=270) |
| B2 | Tan/light-brown brick with recessed vertical window bays in light precast frames | `#9a8168` | punched | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4712,-80.5437&heading=170) [2](https://www.reddit.com/r/uwaterloo/comments/1p8dzki/uwaterloo_building_alignment_chart/) |
| C2 | Warm orange-tan brick over a raw concrete base | `#a0704c` | ribbon | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4720,-80.5434&heading=90) [2](https://www.reddit.com/r/uwaterloo/comments/1p8dzki/uwaterloo_building_alignment_chart/) |
| ESC | Buff/tan brick wings. The south facade is white/off-white precast (`#d8d6cc`) with cantilevered window bays and fins, raised on pilotis over the main walkway | `#c4a98a` | punched (brick) / slot (precast) | medium | [1](https://commons.wikimedia.org/wiki/File:BIO_Connetion.jpg) [2](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.47082,-80.54275&heading=0) |
| E2 | Buff/tan-brown brick with precast band courses and a grid of concrete fins; dark spandrels | `#9c8670` | punched | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4712,-80.5400&heading=240) |
| E3 | Buff/tan speckled brick on a light concrete base. Only the north-west face was seen | `#a8927a` | ribbon | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4722,-80.5410&heading=150) |
| STC | Medium-dark brown brick plus stepped dark charcoal metal-panel volumes (`#4f5256`); glass atria and glazed bridges | `#6e5244` | mixed | medium | [1](https://science-teaching-complex-stc.wheree.com/) [2](https://www.google.com/search?udm=2&q=ZAS+Architects+University+of+Waterloo+Science+Teaching+Complex) |
| EV1 | Red-brown/brown brick with concrete trim; central courtyard under a glass roof | `#7e5040` | ribbon | low | [1](https://uwaterloo.ca/environment/about/ev3-leedr-platinum-certified) |
| EV2 | Orange-red brick, 2 storeys; EV3 rises behind it | `#9a4e36` | punched | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4676,-80.5440&heading=60) [2](https://uwaterloo.ca/environment/about/ev3-leedr-platinum-certified) |
| NH | Original block: mid-brown brick with deep recessed window bands. 2015 expansion: orange-red brick (`#a85c3c`), curtain wall, a light grey panel upper volume and a glazed bridge | `#7a5442` | mixed | medium | [1](https://www.allesdrywall.com/Featured-Project-University-of-Waterloo.htm) [2](https://uwaterloo.ca/accessability-services/news/needles-hall-expansion) |
| TC | Red/red-brown brick box with glazed corner and entrance volumes and a light metal parapet | `#8a4434` | mixed | high | [1](https://commons.wikimedia.org/wiki/File:TC_01.jpg) [2](https://commons.wikimedia.org/wiki/File:Waterloo_ontario_campus_1.jpg) |
| SCH | Dark chocolate-brown brick with white fascia bands and parapets; stepped massing | `#6a5450` | punched | high | [1](https://commons.wikimedia.org/wiki/File:Panorama_UW_south_campus_hall.jpg) |
| GSC | Dark brown brick, low service buildings with deep loading canopies; grey metal plant building next door; brick smokestack nearby | `#5c4634` | punched (few) | medium | [1](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=43.4740,-80.5438&heading=120) [2](https://commons.wikimedia.org/wiki/File:Chimney.jpg) |

### What changed from pass 1

- **E2 is buff/tan-brown brick with concrete fins.** Pass 1 had red-brown brick.
- **The 1960s science cluster (B1, B2, C2, ESC) is buff/tan brick, not grey precast.** ESC's south facade is the white precast section with the walkway underpass. Pass 1 attributed that facade to B1/B2.
- **STC is brown brick plus dark charcoal panels**, not red-brown brick.
- **EV1 is brown/red-brown brick**, not buff (low confidence). **EV2 is orange-red brick**, as pass 1 guessed.
- **SCH and GSC are darker brown than pass 1's hexes.** TC is confirmed.

### Caveats

- The Street View views of B1/B2/C2/ESC/E2 are from 2014. EV1 is still weak: I found no clear, full exterior photo of it.
