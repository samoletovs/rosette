# Latvia (LV) — Electrical Installation Standards

## Metadata
- **country**: Latvia
- **country_code**: LV
- **standard**: LBN 261-23 (Ēku iekšējās elektroinstalācijas)
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
- **Accessible/disabled**: 400–1000 mm from floor per accessibility requirements
- **Outdoor**: Minimum 500 mm from ground level, IP44 or higher rating

### Minimum Distances
- **From door frame**: Minimum 100 mm
- **From room corner**: Minimum 150 mm
- **From water source (sink, bath)**: Minimum 600 mm horizontally
- **From gas installation**: Minimum 500 mm
- **From heating radiator**: Minimum 500 mm

### Bathroom Zones (per IEC 60364-7-701)
- **Zone 0**: Inside bath/shower — no sockets allowed
- **Zone 1**: Above bath/shower up to 2250 mm height — no sockets allowed
- **Zone 2**: 600 mm around Zone 1 — only shaver sockets with isolation transformer
- **Zone 3 / Outside zones**: Standard sockets allowed with RCD (30mA) protection

### General Requirements
- All socket circuits must be protected by 30mA RCD (residual current device)
- Maximum 10 socket outlets per circuit (16A)
- Dedicated circuits required for high-power appliances (oven, washing machine, dryer, dishwasher)
- All installations must comply with fire safety requirements per LBN 201-15

## Room Rules

### Kitchen
- **minimum_sockets**: 6
- **dedicated_circuits**: Oven (separate 32A), dishwasher, refrigerator
- **countertop_sockets**: Minimum 4 above worktop (1000–1200 mm height)
- **notes**: At least one double socket per 1.5m of worktop. Sockets near sink must be minimum 600mm from water source.

### Living Room
- **minimum_sockets**: 5
- **per_wall**: At least 1 double socket on each wall
- **tv_wall**: Recommended 3 sockets (TV + peripherals)
- **notes**: Consider floor sockets for center-room furniture arrangements.

### Bedroom
- **minimum_sockets**: 4
- **bedside**: 1 double socket each side of bed (600 mm height recommended)
- **general**: 1 double socket on opposite wall
- **notes**: Consider USB-integrated sockets for charging convenience.

### Bathroom
- **minimum_sockets**: 1 (outside zone 2)
- **shaver_socket**: 1 shaver socket allowed in Zone 2 (with isolation transformer)
- **washing_machine**: Dedicated socket if washing machine is located here
- **notes**: All sockets must have RCD protection (30mA). IP44 minimum rating in Zone 2. No sockets in Zones 0 and 1.

### Hallway / Corridor
- **minimum_sockets**: 2
- **notes**: At least 1 socket near entrance (for vacuum cleaner, shoe dryer). 1 additional every 5m of corridor length.

### Home Office / Study
- **minimum_sockets**: 4
- **desk_area**: Minimum 3 sockets at desk height (desk-level or slightly above: 700–900 mm)
- **notes**: Consider dedicated circuit for computer equipment.

### WC (Separate Toilet)
- **minimum_sockets**: 1
- **notes**: Socket must be outside wet zones. Consider ventilation fan connection.

### Utility Room / Laundry
- **minimum_sockets**: 3
- **dedicated_circuits**: Washing machine, dryer (each on separate circuit)
- **notes**: Sockets at 1000 mm height recommended to avoid water splash.

### Garage
- **minimum_sockets**: 2
- **notes**: IP44 rated sockets required. Consider 32A socket for EV charging. Dedicated circuit for power tools.

### Balcony / Terrace
- **minimum_sockets**: 1
- **notes**: IP44 rated minimum. Protected by RCD.

## Circuit Requirements

### Standard Socket Circuit
- **breaker**: 16A MCB (Miniature Circuit Breaker), Curve B or C
- **cable**: 3×2.5 mm² (NYM-J or equivalent)
- **max_sockets_per_circuit**: 10
- **rcd**: 30mA Type A or Type AC

### Lighting Circuit
- **breaker**: 10A MCB
- **cable**: 3×1.5 mm²
- **max_points_per_circuit**: 12

### Dedicated Appliance Circuits
- **electric_oven**: 32A MCB, 3×6 mm² cable
- **electric_hob**: 32A MCB, 5×4 mm² (three-phase) or 3×6 mm² (single-phase)
- **washing_machine**: 16A MCB, 3×2.5 mm², dedicated circuit
- **dishwasher**: 16A MCB, 3×2.5 mm², dedicated circuit
- **dryer**: 16A MCB, 3×2.5 mm², dedicated circuit
- **boiler**: 16A or 20A MCB, 3×2.5 mm² or 3×4 mm², dedicated circuit
- **ev_charger**: 32A MCB, 3×6 mm² or 5×6 mm² (three-phase)

### Earthing
- **system**: TN-C-S or TN-S
- **main_earth**: Minimum 16 mm² copper or 25 mm² aluminium
- **equipotential_bonding**: Required in bathrooms, connecting all metal parts

## Wiring

### Wire Colors (per IEC 60446 / HD 308 S2, adopted via LBN 261-23)
- **L (Line)**: Brown
- **N (Neutral)**: Blue
- **PE (Protective Earth)**: Green-Yellow
- **L2 (Line 2, three-phase)**: Black
- **L3 (Line 3, three-phase)**: Grey

### Cable Types
- **Primary**: NYM-J (copper, PVC-insulated, per LVS EN 50575)
- **Alternative**: VVGng (commonly used in older Latvian installations)
- **Outdoor/damp**: NYM-J in protective conduit or NYY-J direct burial

### Cable Sizing by Circuit
- **Standard 16A socket circuit**: 3×2.5 mm² NYM-J (3 wires: L, N, PE)
- **Lighting 10A circuit**: 3×1.5 mm² NYM-J
- **Oven 32A dedicated**: 3×6 mm² NYM-J
- **Three-phase hob**: 5×4 mm² NYM-J (5 wires: L1, L2, L3, N, PE)
- **EV charger 32A three-phase**: 5×6 mm² NYM-J

### Maximum Cable Run Lengths (voltage drop ≤3% per IEC 60364-5-52)
- **3×2.5 mm² @ 16A**: ~27 m maximum
- **3×1.5 mm² @ 10A**: ~27 m maximum
- **3×6 mm² @ 32A**: ~27 m maximum
- **5×4 mm² @ 32A (three-phase)**: ~36 m maximum

### Distribution Board Placement
- **Preferred locations**: Hallway near entrance, utility room, or garage
- **Height**: 1400–1800 mm from finished floor level (center of board)
- **Access**: Must be easily accessible, dry location, minimum 600 mm clearance in front
- **Reference**: LBN 261-23 §52 (wiring methods and distribution board requirements)
