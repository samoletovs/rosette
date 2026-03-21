# Electrical Installation Standards Format

This directory contains construction standards for electrical socket placement
by country. Each file follows a consistent structure for automated parsing.

## Adding a New Country

1. Create a new `.md` file named `{country-code}.md` (e.g., `de.md` for Germany)
2. Follow the structure defined in existing files
3. The backend auto-discovers all `.md` files in this directory

## Structure

Each file contains:
- **metadata**: Country info, standard references, voltage/frequency
- **general_rules**: Universal placement rules (heights, distances)
- **room_rules**: Per-room-type minimum socket requirements
- **circuit_requirements**: Circuit protection and wiring specs
