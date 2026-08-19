# Zee Skycard

**Zee Energy — Home Assistant Custom Energy Flow Card · Sky Edition**

`zee-skycard.js` · Sky Edition **v2.9.11**

<img src="https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-skycard.png" alt="Zee Skycard">

<img src="https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/Screenshot-skycard-rainy.png" alt="Zee Skycard rainy">


> **Origin:** `zee-skycard` is forked from [`khan-skycard`](https://github.com/thekhan1122/khan-skycard) by [thekhan1122](https://github.com/thekhan1122) and has been updated and customized for **Zee's Home** setup. It lives in its own separate repository, replacing the entire SVG canvas with a photographic background system and redesigned celestial / inverter visuals.

---

## Overview

`zee-skycard` is a custom Home Assistant Lovelace card that renders a live, animated energy-flow diagram against a full-card photographic sky background. Thirteen background images cover every ma
jor weather condition and time-of-day combination — the card selects the correct image automatically from a connected `weather` entity and the current sun elevation.

The card is self-contained in a single JavaScript file — no NPM, no build step, no additional dependencies.

**Works with any inverter, battery, and sensors.** Every entity is mapped through the visual editor, so the card is not tied to one brand — GoodWe, Deye, Solis, LuxPower, Victron, JK BMS, Daly BMS, generic Home Assistant sensors, and more are all supported. Power sensors are auto-detected in W or kW, energy totals in Wh, kWh or MWh, and temperatures in °C or °F. Solar strings and monitoring sections are optional and simply hide their tiles when left empty.

---

📦 Installation
Option A — HACS (Recommended)

Requires HACS to be installed in Home Assistant.

Open HACS in Home Assistant → Frontend.
Click the ⋮ menu (top-right) → Custom repositories.
Paste your repository URL:

   https://github.com/realzeepro/zee-skycard

Set category to Lovelace and click Add.
Search for zee-skycard and click Download.
HACS automatically downloads the card and all icon files into /config/www/community/zee-skycard/. No manual file copying needed.
Hard-refresh your browser (Ctrl + Shift + R / Cmd + Shift + R).


HACS registers the Lovelace resource automatically. Skip the manual resource step below.


Option B — Manual Installation

Go to the repository and download these files from the dist/ folder:

zee-skycard.js


Create the folder /config/www/community/zee-skycard/ and place zee-skycard.js inside it. Then create a sky/ subfolder with the 13 background images (see below).
## Sky Images
The card needs 13 PNG files placed at:

```

| Filename (no extension) | Condition |
|---|---|
| `sky-clear-day` | Clear sky, daytime |
| `sky-clear-dawn` | Clear sky, dawn / dusk transition |
| `sky-clear-dusk` | Clear sky, dusk |
| `sky-night-clear` | Clear sky, night |
| `sky-partlycloudy-day` | Partly cloudy, daytime |
| `sky-partlycloudy-night` | Partly cloudy, night |
| `sky-cloudy-day` | Overcast, daytime |
| `sky-cloudy-night` | Overcast, night |
| `sky-rainy-day` | Rain, daytime |
| `sky-rainy-night` | Rain, night |
| `sky-thunderstorm` | Thunderstorm (any time) |
| `sky-snowy-day` | Snow, daytime |
| `sky-fog-day` | Fog / mist (any time) |
```

All images must be **PNG** format. 

---

## Quick Start (5 steps)

New to the card? The editor pre-fills entity pickers with *example* sensors from the author's GoodWe/JK setup — replace them with your own. Here is the fastest path to a working card:

1. **Add the card** to a dashboard: click **＋ Add card → zee-skycard** (or paste a `type: custom:zee-skycard` YAML card).
2. **Map your sensors.** Open the editor and work through **Solar** (PV1/PV2 Power), **Grid** (Grid Active Power), and **Battery** (SOC, Power, Current, Voltage). Empty pickers hide their stat — you don't need every sensor.
3. **Set your battery capacity.** In **General → Battery Capacity** enter your pack size in Ah (or kWh). This is required for the **Remaining** and **Endurance** tiles. *Example: 314 Ah for the 16 kWh GoodWe Lynx A G3.*
4. **Check the sign convention.** If grid/battery readings point the wrong way, use the **🔄 Invert grid/battery power sign** toggles in the Grid/Battery sections.
5. **Pick a weather entity** (General section) so the sky background matches your conditions — optional, but recommended. Then enable any monitoring sections you want with their **+ Enable** chips (Cameras, Smart Plugs, Climate, Room Sensors, EV…).

After saving, every tile should show live values. Anything still showing `--`? See [Troubleshooting](#troubleshooting).

---

## Configuration Reference

All keys are configured through the visual editor. YAML equivalents are listed below for reference.

### General / Sky

| Key | Default | Description |
|---|---|---|
| `inverter_name` | `''` | Label shown in the inverter pill badge |
| `weather_entity` | `''` | Weather entity — drives sky image selection |
| `pv_max_power` | `7500` | Max PV power for bar scaling (W) |
| `inverter_max_power` | `6000` | Inverter max power for PWR bar scaling (W) |

### Solar

| Key | Default | Description |
|---|---|---|
| `pv1_power` | `sensor.goodwe_pv1_power` | PV string 1 power (W) |
| `pv2_power` | `sensor.goodwe_pv2_power` | PV string 2 power (W) |
| `pv3_power` | `''` | PV string 3 — optional, enable via Extra PV toggle |
| `pv4_power` | `''` | PV string 4 — optional, enable via Extra PV toggle |
| `pv_total_power` | `sensor.goodwe_pv_power` | Total PV power (W) |
| `today_pv` | `sensor.goodwe_today_s_pv_generation` | Today's PV generation (kWh) |
| `total_pv_gen_entity` | `sensor.goodwe_total_pv_generation` | Lifetime PV generation (kWh) |
| `inv_temp` | `sensor.goodwe_inverter_temperature_module` | Inverter temperature |
| `today_batt_chg` | `sensor.goodwe_today_battery_charge` | Today battery charge (kWh) |
| `today_load` | `sensor.goodwe_today_load` | Today load (kWh) |
| `consump` | `sensor.goodwe_house_consumption` | House consumption (W) |
| `sun` | `sun.sun` | Sun entity — drives celestial orb position |

### Grid

| Key | Default | Description |
|---|---|---|
| `grid_active_power` | `sensor.goodwe_active_power` | Grid active power (W) |
| `grid_import_energy` | `sensor.goodwe_today_energy_import` | Today grid import (kWh) |
| `grid_export_energy` | `''` | Today grid export (kWh) — optional |
| `grid_today_import` | `sensor.goodwe_today_import_meter_calculated` | Today Import tile (kWh) |
| `grid_today_export` | `sensor.goodwe_today_export_meter_calculated` | Today Export tile (kWh) |
| `grid_power_alt` | `sensor.grid_phase_a_power` | Alternate grid power sensor |
| `invert_grid_power` | `false` | Invert sign — enable if positive = exporting |

### Primary Battery

| Key | Default | Description |
|---|---|---|
| `_show_battery` | `true` | Show primary battery section |
| `battery_soc` | `sensor.jk_soc` | Battery state of charge (%) |
| `battery_power` | `sensor.jk_power` | Battery power (W) |
| `battery_current` | `sensor.jk_current` | Battery current (A) |
| `battery_voltage` | `sensor.jk_voltage` | Battery voltage (V) |
| `battery_temp1` | `sensor.jk_temp1` | Cell temp probe 1 |
| `battery_temp2` | `sensor.jk_temp2` | Cell temp probe 2 |
| `battery_mos` | `sensor.jk_mos` | BMS MOS temperature |
| `battery_min_cell` | `sensor.jk_cellmin` | Min cell voltage |
| `battery_max_cell` | `sensor.jk_cellmax` | Max cell voltage |
| `batt_dis` | `sensor.goodwe_today_battery_discharge` | Today discharge (kWh) |
| `battery_full_ah` | `0` | Battery capacity (Ah) — set yours; required for Remaining/Endurance tiles |
| `battery_full_wh` | `0` | Battery capacity (Wh) — set yours; required for Remaining/Endurance tiles |
| `battery_cap_unit` | `ah` | Capacity unit shown in editor: `ah` or `kwh` |
| `goodwe_battery_soc` | `sensor.goodwe_battery_state_of_charge` | GoodWe-only SOC fallback — used when the primary SOC sensor is unavailable |
| `goodwe_battery_curr` | `sensor.goodwe_battery_current` | GoodWe-only current fallback — used when the primary current sensor is unavailable |
| `invert_battery_power` | `false` | Invert sign — enable if positive = discharging |

### Secondary Battery

| Key | Default | Description |
|---|---|---|
| `_show_battery2` | `false` | Enable secondary battery (chip toggle) |
| `battery2_soc` | `''` | Secondary SOC (%) |
| `battery2_power` | `''` | Secondary power (W) |
| `battery2_current` | `''` | Secondary current (A) |
| `battery2_voltage` | `''` | Secondary voltage (V) |
| `battery2_mos` | `''` | Secondary BMS temperature |

### EV / Car Charger

| Key | Default | Description |
|---|---|---|
| `_show_ev` | `false` | Enable EV section (chip toggle) |
| `charger_state` | `''` | Charger state entity (string: `charging`, `completed`, etc.) |
| `charger_power` | `''` | Charger power (W) |
| `charger_current` | `''` | Charger current (A) |
| `charger_soc` | `''` | Car battery SOC (%) |
| `charger_eta` | `''` | Charge ETA in minutes — optional |
| `charger_battery_capacity_wh` | `''` | EV battery capacity (Wh) |

### Labels

| Key | Default | Description |
|---|---|---|
| `_labels_custom_entities` | `false` | Enable Labels section (chip toggle) |
| `label_cell_temp_minmax` | `CELL TEMP MIN/MAX` | Tile label — cell temp |
| `label_bms_temp` | `BMS TEMP` | Tile label — BMS temp |
| `label_min_cell` | `Min Cell` | Tile label — min cell voltage |
| `label_max_cell` | `Max Cell` | Tile label — max cell voltage |
| `label_batt_dis` | `Batt Dis.` | Tile label — battery discharge |
| `label_total_pv_gen` | `TOTAL PV GEN.` | Tile label — total PV generation |
| `label_grid_import_today` | `Today Import` | Tile label — Today Import |
| `label_grid_export_today` | `Today Export` | Tile label — Today Export |
| `label_entity_cell_temp` | `''` | Override entity for cell temp tile |
| `label_entity_bms_temp` | `''` | Override entity for BMS temp tile |
| `label_entity_min_cell` | `''` | Override entity for min cell tile |
| `label_entity_max_cell` | `''` | Override entity for max cell tile |
| `label_entity_batt_dis` | `''` | Override entity for batt dis tile |

> **Entity override rule:** A Labels entity picker activates only after its label text is changed from the default. The matching picker in the Battery section locks with an "Overridden by Labels" veil to prevent duplication. Battery voltage pickers are never locked.

---

## Visual Editor Sections

| Section | Toggle | Description |
|---|---|---|
| General | — | Inverter name, weather entity, power limits |
| Labels | `+ Enable` chip | Rename stat tiles; per-row entity overrides |
| Solar | — | PV1, PV2 entities |
| Extra PV Strings | `+ Enable` chip | PV3, PV4 |
| Solar Extras | — | Totals, temperatures, today stats |
| Grid | — | Grid power, import/export, consumption |
| Primary Battery | `+ Enable` chip | Full BMS telemetry |
| Secondary Battery | `+ Enable` chip | Second pack |
| System Limits | `+ Enable` chip | Capacity and power limits |
| EV / Car Charger | `+ Enable` chip | Charger state, SOC, ETA |
| Monitoring: Cameras | `+ Enable` chip | Up to 4 live camera feeds, click to expand |
| Monitoring: System | `+ Enable` chip | CPU, memory, temps, network, uptime |
| Monitoring: Smart Plugs | `+ Enable` chip | Toggle plugs, power/voltage/current |
| Monitoring: Climate | `+ Enable` chip | AC temperature and mode |
| Monitoring: Room Sensors | `+ Enable` chip | Room temp, humidity, sensor battery |
| Monitoring: Fridge | `+ Enable` chip | Fridge/freezer temps, mode, door sensors |
| Monitoring: Water Heater | `+ Enable` chip | Water heater temp, set temp, mode, power |

---

## Monitoring Popups

Clickable stat tiles open popup dialogs for a closer look at live data.

### Inverter ⚡

Click the inverter tile to open the inverter popup: **Error** status, **Inverter Temp**, **Rad Temp**, **Total Hours**, and **Mode** — plus **DoD On-grid**, **DoD Off-grid**, and **Export Limit** sliders that write back to the inverter when the matching entities are set.

![Inverter popup card](https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-inverter-popup.png)

### Cameras 📷

Enable the **Cameras** section to show up to 4 live camera feeds (2×2 grid).

| Key | Default | Description |
|---|---|---|
| `_show_camera` | `false` | Show cameras tile (chip toggle) |
| `camera_1_entity` … `camera_4_entity` | `''` | Camera entity (streams via `/api/camera_proxy_stream/`) |
| `camera_1_name` … `camera_4_name` | `Camera 1` … `Camera 4` | Camera label used only in the expanded view title |

Behavior:
- Feeds stream **live** via HA's signed camera proxy (`auth/sign_path`) — the browser renders a continuous MJPEG stream, not a frozen snapshot. Falls back to a single snapshot only if signing is unavailable.
- Click any camera tile to expand it to a single large view — no cropping (`object-fit: contain`, 16:9).
- The **← Back to all cameras** button returns to the grid.
- Tiles show no persistent labels; the camera name appears only in the expanded view title.

### Battery 🔋

The battery popup shows full BMS telemetry, ordered: **Battery Status → SOC → Voltage → Power → Current → Cell Max V → Cell Min V → SOH → Index → BMS Version → Cell Max Temp → Cell Min Temp → BMS Temp**.

The **Current (A)** entry sits right after **Power (W)** and reads `battery_current`, falling back to `goodwe_battery_curr` when set.

![Battery popup card](https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-battery-popup.png)

### Smart Plugs 🔌

Enable the **Smart Plugs** section to toggle up to 2 plugs on/off and see each plug's live **Power**, **Voltage**, and **Current**.

![Smart plugs popup card](https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-smart-plugs-popup.png)

### Climate ❄️

Enable the **Climate** section to adjust the temperature and switch AC modes (heat/cool/dry/fan/auto) from the popup.

![AC popup card](https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-ac-popup.png)

### Rooms 🏠

Enable the **Room Sensors** section to show room temperature cards (2 rooms). Each card shows the **room name**, **Temperature (°C)**, **Humidity (%)**, and the sensor **Battery (%)** chip in the header.

| Key | Default | Description |
|---|---|---|
| `_show_rooms` | `false` | Show rooms tile (chip toggle) |
| `room_1_name` / `room_2_name` | `Room 1` / `Room 2` | Room display name |
| `room_1_temp` / `room_2_temp` | `''` | Room temperature entity |
| `room_1_humidity` / `room_2_humidity` | `''` | Room humidity entity |
| `room_1_battery` / `room_2_battery` | `''` | Sensor battery level entity |

Temperature colour follows the threshold system; the battery chip turns orange ≤40% and red ≤20%.

![Rooms popup card](https://raw.githubusercontent.com/realzeepro/zee-skycard/main/screenshots/screenshot-rooms-popup.png)

### Fridge 🗄️

Enable the **Fridge** section to show fridge and freezer temperatures, set temperatures, the fridge mode, and door sensor states. Door chips turn **red when open** and green when closed; every value opens the HA more-info dialog on click. The fridge tile shows the **current mode** (e.g. `ECO`, `SUPER COOL`) instead of a static label.

| Key | Default | Description |
|---|---|---|
| `_show_fridge` | `false` | Show fridge tile (chip toggle) |
| `fridge_name` | `Haier 538 IOT` | Fridge display name |
| `fridge_current_temp` | `''` | Fridge current temperature |
| `fridge_set_temp` | `''` | Fridge set temperature |
| `freezer_current_temp` | `''` | Freezer current temperature |
| `freezer_set_temp` | `''` | Freezer set temperature |
| `fridge_mode` | `''` | Fridge mode entity (string) |
| `fridge_door` | `''` | Fridge door binary_sensor |
| `freezer_door` | `''` | Freezer door binary_sensor |

### Water Heater ♨️

Enable the **Water Heater** section to show current/set temperature, mode, and power. Its monitoring tile **replaces the Rooms tile** whenever the water heater's current-temperature sensor is available; when the sensor is unavailable, the Water Heater tile is hidden and the Rooms tile shows normally. Every value opens the HA more-info dialog on click.

| Key | Default | Description |
|---|---|---|
| `_show_water_heater` | `false` | Show water heater tile (chip toggle) |
| `water_heater_name` | `Water Heater` | Water heater display name |
| `water_heater_current_temp` | `''` | Current water temperature |
| `water_heater_set_temp` | `''` | Target water temperature |
| `water_heater_mode` | `''` | Water heater mode entity (string) |
| `water_heater_power` | `''` | Water heater power (W) |

### Others

The **System** popup opens from its monitoring tile when enabled.

---

## Colour Logic

| Metric | Thresholds |
|---|---|
| **SOC** | ≤25% red · ≤50% orange · ≤75% blue · >75% green |
| **Cell Temp** | ≤15°C blue · ≤35°C green · ≤45°C orange · >45°C red |
| **Cell Voltage** | <3.0V red · <3.1V orange · <3.4V yellow · ≤3.65V green · >3.65V red |
| **Inverter / Env Temp** | ≤25°C green · ≤45°C orange · >45°C red |
| **PWR bar** | 0% blue → 100% orange (continuous gradient) |

---

## File Structure

```
/config/www/community/zee-skycard/
│
├── zee-skycard.js              ← single JS file, register as Lovelace resource
│
└── sky/                         ← 13 PNG background images
    ├── sky-clear-day.png
    ├── sky-clear-dawn.png
    ├── sky-clear-dusk.png
    ├── sky-night-clear.png
    ├── sky-partlycloudy-day.png
    ├── sky-partlycloudy-night.png
    ├── sky-cloudy-day.png
    ├── sky-cloudy-night.png
    ├── sky-rainy-day.png
    ├── sky-rainy-night.png
    ├── sky-thunderstorm.png
    ├── sky-snowy-day.png
    └── sky-fog-day.png
```

### Internal class structure

```
zee-skycard.js
│
├── class KhanSkyCardEditor      (visual editor — HTMLElement)
│   ├── _render()                builds editor sections
│   ├── makeSection()            collapsible section with optional chip toggle
│   ├── picker()                 ha-selector entity picker
│   ├── textField()              native input, commits on blur/Enter
│   ├── numberField()            numeric input, commits on blur/Enter
│   ├── switchRow()              pill toggle (invert flags)
│   ├── labelRow()               text field + conditionally-enabled entity picker
│   └── pickerMaybeDisabled()    picker with override veil overlay
│
└── class KhanSkyCard            (main card — HTMLElement)
    ├── setConfig()              merges config, triggers static build
    ├── _buildStaticSVG()        renders SVG canvas + HTML stat panel (once per config)
    ├── _updateDynamic()         updates all live values, colours, animations (every hass update)
    ├── _skyImage()              selects background PNG from weather entity + sun elevation
    ├── _sunOrbHTML()            photorealistic sun — halo, corona rays, colour shift
    ├── _moonSVG()               SVG crescent moon — mask, craters, earthshine glow
    ├── _buildPvBlocksHTML()     flat coloured PV bar segments
    ├── _val()                   safe numeric entity reader
    ├── _strVal()                safe string entity reader
    ├── _socColor()              SOC → hex colour
    ├── _cellTempColor()         temperature → hex colour
    ├── _cellVoltColor()         cell voltage → hex colour
    ├── _tempColor()             general temperature → hex colour
    ├── _remCapColor()           remaining capacity → hex colour
    └── _fmtTill()               hours → "Till HH:MM" or "in Xh Ym" string
```

---

## Credits

This project is forked from:

- **[khan-skycard](https://github.com/thekhan1122/khan-skycard)** by [thekhan1122](https://github.com/thekhan1122) — the original card this project builds on (entity schema, visual editor, and base design), updated and customized for Zee's Home setup.

Huge thanks to the original author for the foundation.

---

## Changelog

### v1.0.0-pre *(this release)*

Full visual overhaul of `khan-skycard`. Forked into a separate repository as **zee-skycard — Sky Edition**.

**Background & layout**
- Full-card photographic PNG background system — 13 images covering weather condition × time of day.
- Sky images served from `/local/community/zee-skycard/sky/`. Background selected dynamically via `weather_entity` + `sun.sun` elevation.
- Grid pylon repositioned to left to match photo composition. House and grid tower rendered in the photograph — SVG overlays removed.
- Battery SVG (fill bar, SOC %, voltage) moved to right side, mirrored from previous left position. Battery cylinder removed from photo layer.

**Inverter node**
- Large INV box replaced with a tiny amber-bordered pill badge (64 × 22 px) positioned between the house window pillars.
- Floating glassmorphism banner added above the badge showing inverter name, TEMP, and LOAD %.

**Celestial objects**
- Sun arc path, horizon line, rise/set dots, and time labels removed.
- Sun and moon now travel freely across the card without a fixed arc track.
- Sun (`_sunOrbHTML`): full photorealistic rewrite — atmospheric scatter halo, mid corona, inner halo, 16 alternating corona rays (inline SVG, 1 rpm rotation), brilliant core with 4-layer box-shadow. Colour shifts from horizon-orange at low elevation to zenith-white at peak.
- Moon (`_moonSVG`): full rewrite — SVG mask crescent, earthshine blue glow, limb-darkening surface gradient, 6 craters clipped to lit face, limb brightening.

**Flow paths**
- All paths rerouted to the tiny INV badge: grid and battery paths converge at y=320, load runs vertically from y=430 to badge bottom at y=335.

**PV / PWR bar**
- PV blocks: flat uniform-height coloured segments (green → cyan → yellow) replacing proportional variable-height blocks.
- PWR bar: square-cornered with a live percentage label, continuous colour gradient from blue (0%) to orange (100%).

---

## Notes

- Tested by **Zee** on a Home Assistant **Docker Container** with a **GoodWe ES Uniq 8 kW** inverter and **GoodWe Lynx A G3** battery.
- Default entity IDs in the editor are **examples** from the author's setup — always pick your own sensors.
- The card uses shadow DOM — theme CSS does not penetrate. All colours are hardcoded or driven by entity values.
- Config keys prefixed with `_` (e.g. `_show_battery`) are editor-only boolean toggles stored in the card YAML.
- Sky image selection requires a `weather_entity` to be set. Without it, the card falls back to `sky-clear-day.png`.
- When installed manually, register as `type: module` in Resources.
- Energy units are read from each sensor (`kWh`, `Wh`, `MWh`) and shown as-is.
- Temperature values display in the sensor's own unit (`°C`/`°F`); the colour thresholds are °C-based (see Colour Logic).

---

## Troubleshooting

### Card does not appear / "Custom element doesn't exist"

- Confirm the resource is registered: **Settings → Dashboards → Resources**. You should see `/local/community/zee-skycard/zee-skycard.js` with type `JavaScript Module`.
- Hard refresh: `Ctrl + Shift + R` (Windows/Linux) · `Cmd + Shift + R` (Mac).
- If on the mobile app, clear app cache or force-close and reopen.

---

### Sky background is not showing / wrong image

- Confirm all 13 PNGs are present at `/config/www/community/zee-skycard/sky/` with exact filenames (case-sensitive, no spaces).
- Check that `weather_entity` is set in the card editor and the entity state is not `unavailable`.
- Open browser DevTools → Network tab and filter for `sky-` to see which image is being requested and whether it returns 200 or 404.

---

### Visual editor is blank or fails to load

- Open browser DevTools (`F12`) → Console tab. Look for any red errors referencing `zee-skycard`.
- Ensure no stale or duplicate `zee-skycard` resource entry exists. Remove any duplicates under **Settings → Dashboards → Resources**.

---

### Entities show `--` or do not update

- Open **Developer Tools → States** and confirm the entity exists with a valid numeric state (not `unavailable` or `unknown`).
- Entity IDs are case-sensitive.
- The card skips `unavailable` and `unknown` states by design — tiles show `--` until a valid value is returned.

---

### Flow animations not showing

- Flow paths animate only when the corresponding power reading is above zero.
- Confirm your inverter entities are returning live values.
- `sun.sun` is required for celestial orb positioning; if missing the sun/moon will not render but the rest of the card functions normally.

---

### Battery section is missing

- Primary Battery requires `_show_battery: true`. In the visual editor, click **+ Enable** next to **Primary Battery**.
- Secondary Battery, EV, Extra PV Strings, System Limits, and Labels sections each have their own **+ Enable** chip.

---

### Endurance tile shows `--`

- Requires `battery_full_ah` (capacity in Ah) and `battery_current` to be set and returning valid values.
- If the battery is neither charging nor discharging (current ≈ 0), `--` is shown by design.
- The row reads **Will be Charged** / **Will be Discharged** with the time-to-full or time-to-empty, the current power (`@ 1200 W`), and the **Till** date/time at which the battery reaches full / empty.

---

### Labels pickers are greyed out

- Enable the **Labels** section via its **+ Enable** chip first.
- Each entity picker unlocks only after you change that row's label text from its default — this prevents accidental overrides.

---

### Reporting a bug

Include when filing an issue:
- Home Assistant version
- zee-skycard version
- Browser console errors (screenshot or paste)
- Relevant YAML config snippet (remove sensitive entity names if needed)

---

*Zee Energy · zee-skycard · Sky Edition v2.9.11*
