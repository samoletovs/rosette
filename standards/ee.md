# Estonia (EE) — Electrical Installation Standards

## Metadata
- **country**: Estonia
- **country_code**: EE
- **standard**: EVS-HD 60364 series (Estonian adoption of HD 60364)
- **based_on**: IEC 60364 / HD 60364 (Low-voltage electrical installations)
- **voltage**: 230V (single-phase) / 400V (three-phase)
- **frequency**: 50 Hz
- **socket_type**: CEE 7/4 Schuko (Type F), 16A rated
- **plug_type**: CEE 7/7 (Type E+F hybrid)

## General Rules

### Socket Heights
- **Standard height**: 300 mm from finished floor level (center of socket)
- **Kitchen countertop**: 1000–1200 mm from floor (above worktop level)
- **Bathroom**: Minimum 600 mm from floor, zones apply
- **Accessible/disabled**: 400–1000 mm from floor
- **Outdoor**: Minimum 500 mm from ground level, IP44 or higher

### Minimum Distances
- **From door frame**: Minimum 100 mm
- **From room corner**: Minimum 150 mm
- **From water source (sink, bath)**: Minimum 600 mm horizontally
- **From gas installation**: Minimum 500 mm
- **From heating radiator**: Minimum 500 mm

### Bathroom Zones (per IEC 60364-7-701)
- **Zone 0**: Inside bath/shower — no sockets
- **Zone 1**: Above bath/shower up to 2250 mm — no sockets
- **Zone 2**: 600 mm around Zone 1 — shaver sockets only (isolation transformer)
- **Zone 3 / Outside zones**: Standard sockets with RCD (30mA)

### General Requirements
- All socket circuits protected by 30mA RCD
- Maximum 10 sockets per circuit (16A)
- Dedicated circuits for high-power appliances
- Compliance with Estonian Building Code (Ehitusseadustik)

## Room Rules

### Kitchen
- **minimum_sockets**: 6
- **dedicated_circuits**: Oven (32A), dishwasher, refrigerator
- **countertop_sockets**: Minimum 4 above worktop (1000–1200 mm)
- **notes**: One double socket per 1.5m worktop. 600mm minimum from sink.

### Living Room
- **minimum_sockets**: 5
- **per_wall**: At least 1 double socket per wall
- **tv_wall**: 3 sockets recommended
- **notes**: For rooms over 20 m², add 1 socket per additional 5 m².

### Bedroom
- **minimum_sockets**: 4
- **bedside**: 1 double socket each side
- **general**: 1 double socket opposite wall
- **notes**: USB sockets recommended.

### Bathroom
- **minimum_sockets**: 1 (outside zone 2)
- **shaver_socket**: 1 in Zone 2
- **washing_machine**: Dedicated if applicable
- **notes**: RCD protected (30mA). IP44 in Zone 2.

### Hallway / Corridor
- **minimum_sockets**: 2
- **notes**: 1 near entrance, 1 per 5m length.

### Home Office / Study
- **minimum_sockets**: 4
- **desk_area**: 3 at desk level (700–900 mm)
- **notes**: Dedicated circuit for IT equipment recommended.

### WC (Separate Toilet)
- **minimum_sockets**: 1
- **notes**: Outside wet zones.

### Utility Room / Laundry
- **minimum_sockets**: 3
- **dedicated_circuits**: Washing machine, dryer
- **notes**: 1000 mm height.

### Garage
- **minimum_sockets**: 2
- **notes**: IP44 rated. EV charging (32A) provision.

### Balcony / Terrace
- **minimum_sockets**: 1
- **notes**: IP44, RCD protected.

## Circuit Requirements

### Standard Socket Circuit
- **breaker**: 16A MCB, Curve B or C
- **cable**: 3×2.5 mm² (NYM-J or equivalent)
- **max_sockets_per_circuit**: 10
- **rcd**: 30mA Type A or AC

### Lighting Circuit
- **breaker**: 10A MCB
- **cable**: 3×1.5 mm²
- **max_points_per_circuit**: 12

### Dedicated Appliance Circuits
- **electric_oven**: 32A MCB, 3×6 mm²
- **electric_hob**: 32A MCB, 5×4 mm² or 3×6 mm²
- **washing_machine**: 16A MCB, 3×2.5 mm², dedicated
- **dishwasher**: 16A MCB, 3×2.5 mm², dedicated
- **dryer**: 16A MCB, 3×2.5 mm², dedicated
- **boiler**: 16A–20A MCB, 3×2.5–4 mm², dedicated
- **ev_charger**: 32A MCB, 3×6 mm² or 5×6 mm²

### Earthing
- **system**: TN-C-S or TN-S
- **main_earth**: Minimum 16 mm² copper
- **equipotential_bonding**: Required in bathrooms
