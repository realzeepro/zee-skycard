// zee-skycard.js – Sky Edition v2.9.6

class ZeeSkyCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._attached = false;
    this._rendered = false;
    this._ownChange = false;
  }

  connectedCallback() {
    this._attached = true;
    this._render();
  }

  setConfig(config) {
    // Always update internal config from HA
    this._config = { ...config };
    // _ownChange is set when WE fired config-changed. In that case HA calls setConfig
    // back synchronously — we must NOT re-render or we get an infinite loop.
    // But we do need to re-render for external changes (e.g. another config panel opened,
    // YAML editor, or initial load). Use a microtask-safe guard.
    if (this._ownChange) return;
    if (this._attached) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered && this._attached) {
      this._render();
    } else {
      this.querySelectorAll('ha-selector').forEach(el => { el.hass = hass; });
    }
  }

  _fireChanged() {
    this._ownChange = true;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    }));
    // Use setTimeout(0) — not Promise.resolve() — so _ownChange stays true
    // through ALL synchronous setConfig callbacks HA may fire in this tick.
    clearTimeout(this._ownChangeTimer);
    this._ownChangeTimer = setTimeout(() => { this._ownChange = false; }, 0);
  }

  _set(key, value) {
    if (this._config[key] === value) return;
    this._config = { ...this._config, [key]: value };
    this._fireChanged();
    if (key === '_show_battery'          || key === '_show_battery2'        ||
        key === '_show_pv_extra'         || key === '_show_ev'              ||
        key === '_show_3phase'           || key === 'battery_cap_unit'      ||
        key === '_labels_custom_entities'|| key === '_show_extra_tiles'     ||
        key === '_show_inv_banner'       ||
        key === 'label_cell_temp_minmax' || key === 'label_bms_temp'        ||
        key === 'label_cell_volt'        || key === 'label_pv_voltage'      ||
        key === 'label_remaining'        || key === 'label_endurance'       ||
        key === 'label_today_pv'         || key === 'label_chg_dis'         ||
        key === 'label_grid_import'      || key === 'label_grid_export'     ||
        key === 'label_today_load'       ||
        key === 'label_entity_cell_temp' || key === 'label_entity_bms_temp' ||
        key === 'label_entity_cell_volt' || key === 'label_entity_pv_voltage' ||
        key === 'label_entity_remaining' || key === 'label_entity_today_load' ||
        key === 'label_entity_today_pv'  || key === 'label_entity_chg_dis'  ||
        key === 'label_entity_grid_import'|| key === 'label_entity_grid_export' ||
        key === 'grid_import_today'      ||
        key.startsWith('_extra_tile_')   ||
        key.startsWith('_show_camera')   || key.startsWith('_show_system')    ||
        key.startsWith('_show_smartplugs') || key.startsWith('_show_climate') ||
        key.startsWith('_show_rooms')    || key.startsWith('_show_fridge') ||
        key.startsWith('camera_')        || key.startsWith('smart_plug_')    ||
        key.startsWith('room_')          ||
        key.startsWith('fridge_')        ||
        key.startsWith('clim_')          || key.startsWith('climate_'))
      this._render();
  }

  _render() {
    if (!this._hass) return;
    if (!this._sectionOpen) this._sectionOpen = {};
    const cfg = this._config;
    const showBatt1 = !!(cfg._show_battery !== false);
    const showBatt2 = !!(cfg._show_battery2);
    const showPVExtra = !!(cfg._show_pv_extra);
    const showEV = !!(cfg._show_ev);
    const capUnit = cfg.battery_cap_unit || 'ah'; // 'ah' or 'kwh'

    const style = `
      <style>
        :host { display: block; font-family: var(--paper-font-body1_-_font-family, inherit); }
        .section {
          margin-bottom: 16px;
          border: 1px solid var(--divider-color, rgba(0,0,0,.12));
          border-radius: 10px;
          overflow: hidden;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--secondary-background-color, rgba(0,0,0,.04));
          font-size: .82rem;
          font-weight: 650;
          letter-spacing: .5px;
          text-transform: uppercase;
          color: var(--secondary-text-color);
          cursor: default;
        }
        .section-header.toggleable { cursor: pointer; user-select: none; }
        .section-header .toggle-chip {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: .72rem;
          font-weight: 600;
          letter-spacing: .3px;
          text-transform: none;
          padding: 2px 10px 2px 6px;
          border-radius: 20px;
          background: var(--card-background-color, #fff);
          border: 1px solid var(--divider-color, rgba(0,0,0,.15));
          color: var(--primary-text-color);
          transition: background .15s;
        }
        .section-header .toggle-chip.on {
          background: var(--primary-color, #03a9f4);
          border-color: var(--primary-color, #03a9f4);
          color: #fff;
        }
        .section-body { padding: 12px 14px 4px; }
        .row {
          display: block;
          margin-bottom: 6px;
        }
        .row-label {
          display: block;
          font-size: .78rem;
          font-weight: 500;
          color: var(--primary-text-color);
          margin-bottom: 3px;
          padding-left: 2px;
          line-height: 1.3;
        }
        .row-label small {
          display: inline;
          font-size: .68rem;
          color: var(--secondary-text-color);
          margin-left: 5px;
        }
        .row-input { display: block; width: 100%; }
        ha-selector, ha-textfield { width: 100%; display: block; }
        ha-textfield { --mdc-shape-small: 6px; }
        .divider { height: 1px; background: var(--divider-color, rgba(0,0,0,.08)); margin: 4px 0 14px; }
      </style>
    `;

    const shell = document.createElement('div');
    shell.innerHTML = style;
    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'font-size:1.05rem;font-weight:700;padding:8px 2px 14px;color:var(--primary-text-color);display:flex;align-items:center;gap:8px;letter-spacing:.3px';
    titleBar.innerHTML = '☰ Zee Skycard Configuration';
    shell.appendChild(titleBar);

    // First-run guide banner
    const guideBanner = document.createElement('div');
    guideBanner.style.cssText = 'font-size:.72rem;line-height:1.55;color:var(--secondary-text-color);background:var(--secondary-background-color,rgba(0,0,0,.04));border:1px solid var(--divider-color,rgba(0,0,0,.10));border-left:3px solid var(--primary-color,#03a9f4);border-radius:7px;padding:9px 11px;margin-bottom:14px;';
    guideBanner.innerHTML = '&#x1F4A1; <strong>Quick guide:</strong> Entity pickers are pre-filled with <em>example</em> sensors from the author\u2019s setup (GoodWe/JK) \u2014 pick <strong>your</strong> sensors in each section. Leave a picker empty to hide that stat. <strong>Battery Capacity</strong> (Ah or kWh) is required for the Remaining &amp; Endurance tiles. Sections like Cameras, Smart Plugs, Climate and Room Sensors are off by default \u2014 enable them with the <strong>+ Enable</strong> chip.';
    shell.appendChild(guideBanner);

    const makeSection = (sectionId, icon, title, rows, opts = {}) => {
      if (this._sectionOpen[sectionId] === undefined) this._sectionOpen[sectionId] = (sectionId === 'general');
      const isOpen = this._sectionOpen[sectionId];
      const sec = document.createElement('div');
      sec.className = 'section';
      const hdr = document.createElement('div');
      hdr.className = 'section-header toggleable';
      // Chevron � styled as a small disclosure button
      const chevron = document.createElement('span');
      chevron.textContent = isOpen ? '▼' : '▶';
      chevron.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'width:20px',
        'height:20px',
        'min-width:20px',
        'border-radius:5px',
        'background:var(--secondary-background-color,rgba(255,255,255,.07))',
        'border:1px solid var(--divider-color,rgba(255,255,255,.15))',
        'font-size:.7rem',
        'line-height:1',
        `color:${isOpen ? 'var(--primary-color,#03a9f4)' : 'var(--secondary-text-color,#aaa)'}`,
        'flex-shrink:0',
        'transition:color .15s,background .15s',
        'cursor:pointer',
        'user-select:none',
      ].join(';');
      hdr.appendChild(chevron);
      const titleSpan = document.createElement('span');
      titleSpan.textContent = `${icon} ${title}`;
      hdr.appendChild(titleSpan);
      // Click anywhere on header (except toggle-chip) to collapse/expand
      hdr.addEventListener('click', () => {
        this._sectionOpen[sectionId] = !this._sectionOpen[sectionId];
        this._render();
      });
      if (opts.toggleKey) {
        const chip = document.createElement('span');
        chip.className = 'toggle-chip' + (opts.toggleOn ? ' on' : '');
        chip.innerHTML = opts.toggleOn ? `✓ Enabled` : `＋ Enable`;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this._set(opts.toggleKey, !opts.toggleOn);
        });
        hdr.appendChild(chip);
      }
      sec.appendChild(hdr);
      // Body visible when section is open AND content not suppressed by toggle
      const bodyVisible = isOpen && !opts.hidden;
      if (bodyVisible) {
        const body = document.createElement('div');
        body.className = 'section-body';
        rows.forEach(r => body.appendChild(r));
        sec.appendChild(body);
      }
      return sec;
    };

    const picker = (key, label, optional = false, desc = '') => {
      const wrap = document.createElement('div');
      wrap.className = 'row';
      wrap.style.marginBottom = '14px';
      const lbl = document.createElement('div');
      lbl.className = 'row-label';
      lbl.textContent = label;
      if (optional) {
        const sm = document.createElement('small');
        sm.textContent = 'optional';
        lbl.appendChild(sm);
      }
      if (desc) {
        const d = document.createElement('div');
        d.style.cssText = 'font-size:.66rem;color:var(--secondary-text-color);line-height:1.4;margin-top:1px;padding-left:2px;';
        d.textContent = desc;
        lbl.appendChild(d);
      }
      const inputWrap = document.createElement('div');
      inputWrap.className = 'row-input';
      const sel = document.createElement('ha-selector');
      sel.hass = this._hass;
      sel.selector = { entity: {} };
      sel.value = cfg[key] || '';
      sel._configKey = key;
      sel.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        this._set(key, ev.detail.value || '');
      });
      inputWrap.appendChild(sel);
      wrap.appendChild(lbl);
      wrap.appendChild(inputWrap);
      return wrap;
    };

    // Text field � native input, commits on blur/Enter only.
    // ha-selector(text) fires value-changed per keystroke → triggers setConfig → _render → destroys field.
    const textField = (key, label, placeholder = '') => {
      const wrap = document.createElement('div');
      wrap.className = 'row';
      wrap.style.marginBottom = '14px';
      const fieldBox = document.createElement('div');
      fieldBox.style.cssText = `
        display:block; position:relative;
        border:1px solid var(--divider-color, rgba(0,0,0,.42));
        border-radius:4px;
        padding:6px 12px 6px;
        background:var(--input-fill-color, var(--secondary-background-color, rgba(0,0,0,.04)));
        box-sizing:border-box; width:100%;
        transition: border-color .15s;
      `;
      fieldBox.addEventListener('focusin',  () => { fieldBox.style.borderColor = 'var(--primary-color, #03a9f4)'; });
      fieldBox.addEventListener('focusout', () => { fieldBox.style.borderColor = 'var(--divider-color, rgba(0,0,0,.42))'; });
      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.cssText = `font-size:.72rem; color:var(--secondary-text-color); margin-bottom:2px; line-height:1;`;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = cfg[key] !== undefined ? String(cfg[key]) : '';
      input.style.cssText = `
        display:block; width:100%; border:none; outline:none;
        background:transparent; color:var(--primary-text-color);
        font-size:.95rem; font-family:inherit; padding:0; box-sizing:border-box;
      `;
      // Commit ONLY on blur or Enter � prevents per-keystroke re-render
      const commit = (ev) => this._set(key, ev.target.value);
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });
      fieldBox.appendChild(lbl);
      fieldBox.appendChild(input);
      wrap.appendChild(fieldBox);
      return wrap;
    };

    // Number field � native input, commits on blur/Enter only (same reason as textField).
    const numberField = (key, label, min, max, step, unit = '', desc = '') => {
      const wrap = document.createElement('div');
      wrap.className = 'row';
      wrap.style.marginBottom = '14px';
      const fieldBox = document.createElement('div');
      fieldBox.style.cssText = `
        display:block; position:relative;
        border:1px solid var(--divider-color, rgba(0,0,0,.42));
        border-radius:4px;
        padding:6px 12px 6px;
        background:var(--input-fill-color, var(--secondary-background-color, rgba(0,0,0,.04)));
        box-sizing:border-box; width:100%;
        transition: border-color .15s;
      `;
      fieldBox.addEventListener('focusin',  () => { fieldBox.style.borderColor = 'var(--primary-color, #03a9f4)'; });
      fieldBox.addEventListener('focusout', () => { fieldBox.style.borderColor = 'var(--divider-color, rgba(0,0,0,.42))'; });
      const lbl = document.createElement('div');
      lbl.textContent = unit ? `${label}  (${unit})` : label;
      lbl.style.cssText = `font-size:.72rem; color:var(--secondary-text-color); margin-bottom:2px; line-height:1;`;
      if (desc) {
        const d = document.createElement('div');
        d.style.cssText = 'font-size:.66rem;color:var(--secondary-text-color);line-height:1.4;margin:2px 0;';
        d.textContent = desc;
        lbl.appendChild(d);
      }
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(min); input.max = String(max); input.step = String(step);
      input.value = cfg[key] !== undefined && cfg[key] !== '' ? String(cfg[key]) : '';
      input.style.cssText = `
        display:block; width:100%; border:none; outline:none;
        background:transparent; color:var(--primary-text-color);
        font-size:.95rem; font-family:inherit; padding:0; box-sizing:border-box;
      `;
      // Commit ONLY on blur or Enter � prevents per-keystroke re-render
      const commit = (ev) => {
        let v = parseFloat(ev.target.value);
        if (isNaN(v)) return;
        // Hard-clamp to declared range � browser max attr is advisory only
        v = Math.min(max, Math.max(min, v));
        // Round to step precision to avoid float noise
        if (step >= 1) v = Math.round(v);
        ev.target.value = String(v); // reflect clamped value back into field
        this._set(key, v);
      };
      // oninput: truncate while typing so user can't exceed max digit count
      input.addEventListener('input', () => {
        const raw = input.value.replace(/[^0-9.]/g, '');
        const v = parseFloat(raw);
        if (!isNaN(v) && v > max) input.value = String(max);
      });
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });
      fieldBox.appendChild(lbl);
      fieldBox.appendChild(input);
      wrap.appendChild(fieldBox);
      return wrap;
    };


    // Native CSS pill toggle
    const switchRow = (key, labelText, hintText = '') => {
      const wrap = document.createElement('div');
      wrap.className = 'row';
      wrap.style.cssText = 'margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
      const left = document.createElement('div');
      left.style.flex = '1';
      const lbl = document.createElement('div');
      lbl.className = 'row-label';
      lbl.style.marginBottom = '2px';
      lbl.textContent = labelText;
      left.appendChild(lbl);
      if (hintText) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:.68rem;color:var(--secondary-text-color);line-height:1.4;';
        hint.textContent = hintText;
        left.appendChild(hint);
      }
      const pillLabel = document.createElement('label');
      pillLabel.style.cssText = 'position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0;cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!cfg[key];
      cb.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
      const track = document.createElement('span');
      const knob  = document.createElement('span');
      const sync = () => {
        track.style.cssText = 'position:absolute;inset:0;border-radius:11px;transition:background .2s;background:' +
          (cb.checked ? 'var(--primary-color,#03a9f4)' : 'var(--divider-color,rgba(0,0,0,.25))') + ';';
        knob.style.cssText  = 'position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;' +
          'box-shadow:0 1px 3px rgba(0,0,0,.35);transition:left .2s;left:' + (cb.checked ? '21px' : '3px') + ';';
      };
      sync();
      cb.addEventListener('change', () => { sync(); this._set(key, cb.checked); });
      pillLabel.appendChild(cb);
      pillLabel.appendChild(track);
      pillLabel.appendChild(knob);
      wrap.appendChild(left);
      wrap.appendChild(pillLabel);
      return wrap;
    };

    const divider = () => {
      const d = document.createElement('div');
      d.className = 'divider';
      return d;
    };

    // ═══ Build sections ═══

    // ── Battery capacity radio helper ──
    const battCapUnit = cfg.battery_cap_unit || 'ah';
    const battCapRadio = (() => {
      const outer = document.createElement('div');
      // Radio row
      const radioWrap = document.createElement('div');
      radioWrap.style.cssText = 'display:flex;gap:18px;margin-bottom:10px;';
      const rName = 'bcr_' + Math.random().toString(36).slice(2);
      ['ah', 'kwh'].forEach(unit => {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.82rem;cursor:pointer;color:var(--primary-text-color);';
        const rb = document.createElement('input');
        rb.type = 'radio'; rb.name = rName; rb.value = unit; rb.checked = battCapUnit === unit;
        rb.style.accentColor = 'var(--primary-color,#03a9f4)';
        rb.addEventListener('change', () => { if (rb.checked) this._set('battery_cap_unit', unit); });
        lbl.appendChild(rb);
        lbl.appendChild(document.createTextNode(unit === 'ah' ? 'Ah (Amp-hours)' : 'kWh'));
        radioWrap.appendChild(lbl);
      });
      outer.appendChild(radioWrap);
      // Show the relevant field
      if (battCapUnit === 'ah') {
        outer.appendChild(numberField('battery_full_ah', 'Battery Capacity', 0, 999, 1, 'Ah', 'Required for the Remaining & Endurance tiles. Ah mode also needs a Battery Voltage sensor.'));
      } else {
        outer.appendChild(numberField('battery_full_wh', 'Battery Capacity', 0, 999.99, 0.01, 'kWh', 'Required for the Remaining & Endurance tiles.'));
      }
      return outer;
    })();

    // Capacity group wrapper � plain div, not .row, to avoid nested margin-bottom doubling
    const capGroupWrap = document.createElement('div');
    capGroupWrap.style.marginBottom = '14px';
    const capGroupLbl = document.createElement('div');
    capGroupLbl.className = 'row-label';
    capGroupLbl.textContent = 'Battery Capacity';
    capGroupWrap.appendChild(capGroupLbl);
    capGroupWrap.appendChild(battCapRadio);

    shell.appendChild(makeSection('general', '⚙️', 'General', [
      textField('inverter_name', 'Inverter Name', 'e.g. My Inverter'),
      divider(),
      capGroupWrap,
      divider(),
      numberField('pv_max_power',       'PV Array Max Power',    0, 30000, 100, 'W', 'Scales the PV block fill and animation — set near your array peak.'),
      numberField('inverter_max_power', 'Inverter Max Power',    0, 20000, 100, 'W', 'Scales the PWR bar and inverter LOAD % — set to your inverter rating.'),
      divider(),
      numberField('lower_section_offset', 'Flow diagram vertical offset', -80, 80, 1, 'SVG units (− = up)'),
      divider(),
      picker('weather_entity', 'Weather Entity (sky images)',    true, 'Drives the background sky image. Without it the card falls back to sky-clear-day.'),
    ]));

    // ── Labels: global gate + per-row activation ──
    // Gate: section chip toggles _labels_custom_entities (body hidden when off).
    // Per-row: entity picker activates only when that row's label text differs from its default.
    const labelsEnabled = !!(cfg._labels_custom_entities);

    // Helper: entity picker that can be visually disabled
    const pickerMaybeDisabled = (key, label, disabled = false, optional = false, desc = '') => {
      const wrap = picker(key, label, optional, desc);
      if (disabled) {
        wrap.style.position = 'relative';
        const veil = document.createElement('div');
        veil.style.cssText = [
          'position:absolute', 'inset:0', 'border-radius:6px',
          'background:var(--secondary-background-color,rgba(0,0,0,.06))',
          'opacity:.55', 'pointer-events:all', 'cursor:not-allowed',
          'z-index:10',
        ].join(';');
        const note = document.createElement('div');
        note.style.cssText = [
          'position:absolute', 'inset:0', 'display:flex', 'align-items:center',
          'justify-content:center', 'font-size:.68rem', 'font-weight:600',
          'color:var(--secondary-text-color)', 'letter-spacing:.3px',
          'pointer-events:none', 'z-index:11',
        ].join(';');
        note.textContent = '⛔ Overridden by Labels section';
        wrap.appendChild(veil);
        wrap.appendChild(note);
      }
      return wrap;
    };

    // Per-row active (lock): true when global gate ON AND label text ≠ default AND entity is selected
    // Only lock Battery pickers if user has BOTH renamed the label AND picked a custom entity.
    const _labelChanged = (key, def) => labelsEnabled && (cfg[key] || def) !== def;
    const _labelLocked  = (textKey, def, entityKey) => _labelChanged(textKey, def) && !!(cfg[entityKey]);
    const cellTempActive   = _labelChanged('label_cell_temp_minmax', 'CELL TEMP');
    const bmsTempActive    = _labelChanged('label_bms_temp',         'BMS TEMP');
    const cellVoltActive   = _labelChanged('label_cell_volt',        'CELL VOLT');
    const minCellActive    = cellVoltActive; // alias for battery section lock
    const maxCellActive    = cellVoltActive; // alias for battery section lock
    const pvVoltActive     = _labelChanged('label_pv_voltage',       'PV VOLTAGE');
    const remainActive     = _labelChanged('label_remaining',        'REMAINING');
    // Lock flags for Battery section pickers (stricter — requires entity also set)
    const cellTempLocked   = _labelLocked('label_cell_temp_minmax', 'CELL TEMP',   'label_entity_cell_temp');
    const bmsTempLocked    = _labelLocked('label_bms_temp',         'BMS TEMP',    'label_entity_bms_temp');
    const minCellLocked    = _labelLocked('label_cell_volt',        'CELL VOLT',   'label_entity_cell_volt');
    const maxCellLocked    = minCellLocked; // both use same new key
    const pvVoltLocked     = _labelLocked('label_pv_voltage',       'PV VOLTAGE',  'label_entity_pv_voltage');
    const remainLocked     = _labelLocked('label_remaining',        'REMAINING',   'label_entity_remaining');

    // Label rows � text field + entity picker with live state preview
    const labelRow = (textKey, textLabel, textPlaceholder, entityKey, active = false) => {
      const frag = document.createDocumentFragment();
      frag.appendChild(textField(textKey, textLabel, textPlaceholder));
      const entityRow = document.createElement('div');
      entityRow.style.cssText = 'margin-top:-6px;margin-bottom:14px;';
      const entityLabel = document.createElement('div');
      entityLabel.style.cssText = 'font-size:.72rem;color:var(--secondary-text-color);padding:0 2px 3px;line-height:1;display:flex;align-items:center;gap:6px;';
      entityLabel.textContent = active ? 'Entity (overrides default)' : 'Entity � change label to unlock';
      // State preview badge � shows current entity state text (e.g. "charging", "on grid backup mode")
      const currentEntityId = cfg[entityKey];
      if (active && currentEntityId && this._hass && this._hass.states[currentEntityId]) {
        const stateVal = this._hass.states[currentEntityId].state;
        const badge = document.createElement('span');
        badge.textContent = stateVal;
        badge.style.cssText = [
          'font-size:.65rem', 'font-weight:650', 'letter-spacing:.3px',
          'padding:1px 7px', 'border-radius:20px',
          'background:var(--primary-color,#03a9f4)', 'color:#fff',
          'text-transform:capitalize', 'flex-shrink:0',
        ].join(';');
        entityLabel.appendChild(badge);
      }
      const sel = document.createElement('ha-selector');
      sel.hass = this._hass;
      sel.selector = { entity: {} };
      sel.value = cfg[entityKey] || '';
      sel._configKey = entityKey;
      sel.style.cssText = 'width:100%;display:block;';
      if (!active) {
        sel.style.opacity = '0.4';
        sel.style.pointerEvents = 'none';
        sel.title = 'Change the label text above to unlock this entity picker';
      }
      sel.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        this._set(entityKey, ev.detail.value || '');
      });
      entityRow.appendChild(entityLabel);
      entityRow.appendChild(sel);
      const wrapper = document.createElement('div');
      wrapper.appendChild(frag);
      wrapper.appendChild(entityRow);
      return wrapper;
    };

    // Info banner
    const labelInfoBanner = (() => {
      const info = document.createElement('div');
      info.style.cssText = 'font-size:.72rem;line-height:1.5;color:var(--secondary-text-color);background:var(--secondary-background-color,rgba(0,0,0,.04));border:1px solid var(--divider-color,rgba(0,0,0,.10));border-radius:7px;padding:7px 10px;margin-bottom:10px;';
      info.innerHTML = '&#x1F4A1; <strong>Tip:</strong> Rename a tile label to unlock its entity override. The matching sensor in the Battery section will lock automatically to prevent duplication.';
      return info;
    })();

    // ── Section order: General, Solar, Grid, Battery(+secondary), Inverter, Solar Extras, EV, Customize, Typography, Thresholds ──

    shell.appendChild(makeSection('solar', '☀️', 'Solar', [
      picker('pv1_power', 'PV1 Power', false, 'String 1 generation, in watts.'),
      picker('pv2_power', 'PV2 Power', false, 'String 2 generation, in watts.'),
      picker('pv_total_power', 'Total PV Power', true, 'Optional — falls back to the sum of PV1 + PV2 (+ PV3 + PV4).'),
      divider(),
      pickerMaybeDisabled('pv1_voltage', 'PV1 Voltage', pvVoltLocked, true, 'String 1 voltage (V).'),
      pickerMaybeDisabled('pv2_voltage', 'PV2 Voltage', pvVoltLocked, true, 'String 2 voltage (V).'),
      divider(),
      makeSection('solar_extra', '➕', 'Extra PV Strings', [
        picker('pv3_power', 'PV3 Power', true, 'String 3 generation, in watts.'),
        picker('pv4_power', 'PV4 Power', true, 'String 4 generation, in watts.'),
        pickerMaybeDisabled('pv3_voltage', 'PV3 Voltage', pvVoltLocked, true),
        pickerMaybeDisabled('pv4_voltage', 'PV4 Voltage', pvVoltLocked, true),
      ], { toggleKey: '_show_pv_extra', toggleOn: showPVExtra, hidden: !showPVExtra }),
    ]));

    const show3Phase = !!(cfg._show_3phase);

    shell.appendChild(makeSection('grid', '🔌', 'Grid', [
      switchRow('invert_grid_power', '🔄 Invert grid power sign', 'Enable if positive = exporting (e.g. GoodWe active_power)'),
      divider(),
      picker('grid_active_power',  'Grid Active Power', false, 'Instantaneous import/export power (W).'),
      picker('grid_power_alt',     'Grid Active Power (fallback)', true, 'Used only when the main Grid Active Power sensor is unavailable.'),
      picker('grid_voltage',       'Grid Voltage', true, 'Line voltage (V).'),
      picker('grid_frequency',     'Grid Frequency', true, 'Grid frequency (Hz).'),
      divider(),
      makeSection('grid3phase', '⚡', '3-Phase Breakdown', [
        picker('grid_phase_a', 'Phase L1 Power', true),
        picker('grid_phase_b', 'Phase L2 Power', true),
        picker('grid_phase_c', 'Phase L3 Power', true),
        divider(),
        picker('grid_phase_a_volt', 'Phase L1 Voltage', true),
        picker('grid_phase_b_volt', 'Phase L2 Voltage', true),
        picker('grid_phase_c_volt', 'Phase L3 Voltage', true),
      ], { toggleKey: '_show_3phase', toggleOn: show3Phase, hidden: !show3Phase }),
    ]));

    shell.appendChild(makeSection('battery1', '🔋', 'Battery', [
      switchRow('invert_battery_power', '🔄 Invert battery power sign', 'Enable if positive = discharging'),
      divider(),
      makeSection('batt1inner', '🔋', 'Primary Battery', [
        picker('battery_soc',      'Battery SOC', false, 'State of charge (%).'),
        picker('battery_power',    'Battery Power', false, 'Instantaneous charge/discharge power (W).'),
        picker('battery_current',  'Battery Current', false, 'Charge/discharge current (A) — needed for the Endurance tile.'),
        picker('battery_voltage',  'Battery Voltage', false, 'Pack voltage (V) — used for Ah→Wh conversion.'),
        pickerMaybeDisabled('battery_temp1',    'Temp 1',           cellTempLocked, false, 'Cell temperature probe (°C/°F).'),
        pickerMaybeDisabled('battery_temp2',    'Temp 2',           cellTempLocked, false, 'Cell temperature probe (°C/°F).'),
        pickerMaybeDisabled('battery_mos',      'BMS Temp',         bmsTempLocked, false, 'BMS board temperature (°C/°F).'),
        pickerMaybeDisabled('battery_min_cell', 'Min Cell Voltage', minCellLocked, false, 'Lowest cell voltage (V).'),
        pickerMaybeDisabled('battery_max_cell', 'Max Cell Voltage', maxCellLocked, false, 'Highest cell voltage (V).'),
        divider(),
        picker('goodwe_battery_soc',  'GoodWe SOC Fallback',     true, 'GoodWe-only — used only when Battery SOC is unavailable.'),
        picker('goodwe_battery_curr', 'GoodWe Current Fallback', true, 'GoodWe-only — used only when Battery Current is unavailable.'),
      ], { toggleKey: '_show_battery', toggleOn: showBatt1, hidden: !showBatt1 }),
      divider(),
      makeSection('battery2', '🔋', 'Secondary Battery', [
        picker('battery2_soc',      'SOC'),
        picker('battery2_power',    'Power'),
        picker('battery2_current',  'Current'),
        picker('battery2_voltage',  'Voltage'),
        pickerMaybeDisabled('battery2_mos', 'BMS Temp', bmsTempLocked),
        divider(),
        numberField('battery2_full_ah', 'Battery 2 Capacity (if different from Batt 1)', 0, 999, 1, 'Ah'),
        numberField('battery2_full_wh', 'Battery 2 Capacity (if different from Batt 1)', 0, 999.99, 0.01, 'kWh'),
      ], { toggleKey: '_show_battery2', toggleOn: showBatt2, hidden: !showBatt2 }),
    ]));

    shell.appendChild(makeSection('inverter', '🔄', 'Inverter', [
      switchRow('_show_inv_banner', '📛 Show Inverter Banner', 'Shows the INV temp/load badge in the flow diagram'),
      divider(),
      picker('inv_temp',   'Inverter Temp', false, 'Inverter module temperature (°C/°F).'),
      picker('consump',    'House Consumption', false, 'Instantaneous house load (W).'),
      picker('load_voltage', 'Load Voltage', true, 'House supply voltage (V).'),
      divider(),
      picker('today_batt_chg', 'Today Batt Charge', false, 'Today battery charge energy (kWh).'),
      picker('batt_dis',       'Today Batt Discharge', true, 'Today battery discharge energy (kWh).'),
      picker('total_batt_chg', 'Total Batt Charge', true, 'Lifetime battery charge energy (kWh).'),
      picker('total_batt_dis', 'Total Batt Discharge', true, 'Lifetime battery discharge energy (kWh).'),
      picker('today_pv',       'Today PV Generation', false, 'Today solar generation (kWh).'),
      picker('total_pv',       'Total PV Generation', false, 'Lifetime solar generation (kWh).'),
      picker('today_load', 'Today Load (tile 4)', true, 'Today house consumption (kWh).'),
      picker('total_load_entity', 'Total Load (tile 4)', true, 'Lifetime house consumption (kWh).'),
      picker('grid_import_total', 'Grid Import Total (kWh)', true),
      picker('grid_export_total', 'Grid Export Total (kWh)', true),
    ]));

    const showCamera  = !!(cfg._show_camera);
    const showSystem  = !!(cfg._show_system);
    const showPlugs   = !!(cfg._show_smartplugs);
    const showClimate = !!(cfg._show_climate);
    const showRooms   = !!(cfg._show_rooms);
    const showFridge  = !!(cfg._show_fridge);

    shell.appendChild(makeSection('monitoring', '📡', 'Monitoring', [
      makeSection('mon_cameras', '📷', 'Cameras', [
        textField('camera_1_name', 'Camera 1 Name', 'Camera 1'),
        picker('camera_1_entity', 'Camera 1 Entity', true),
        divider(),
        textField('camera_2_name', 'Camera 2 Name', 'Camera 2'),
        picker('camera_2_entity', 'Camera 2 Entity', true),
        divider(),
        textField('camera_3_name', 'Camera 3 Name', 'Camera 3'),
        picker('camera_3_entity', 'Camera 3 Entity', true),
        divider(),
        textField('camera_4_name', 'Camera 4 Name', 'Camera 4'),
        picker('camera_4_entity', 'Camera 4 Entity', true),
      ], { toggleKey: '_show_camera', toggleOn: showCamera, hidden: !showCamera }),
      divider(),
      makeSection('mon_system_popup', '🖥️', 'System Popup', [
        picker('sys_cpu_entity', 'CPU Usage', true),
        picker('sys_mem_entity', 'Memory Usage', true),
        picker('sys_disk_entity', 'Disk Usage', true),
        picker('sys_uptime_entity', 'Uptime', true),
        divider(),
        picker('sys_core1_temp', 'Core 1 Temp', true),
        picker('sys_core2_temp', 'Core 2 Temp', true),
        picker('sys_package_temp', 'Package Temp', true),
        divider(),
        picker('sys_eth0_rx', 'Eth0 RX', true),
        picker('sys_eth0_tx', 'Eth0 TX', true),
        picker('sys_wlan0_rx', 'Wlan0 RX', true),
        picker('sys_wlan0_tx', 'Wlan0 TX', true),
      ], { toggleKey: '_show_system', toggleOn: showSystem, hidden: !showSystem }),
      divider(),
      makeSection('mon_inverter_popup', '⚡', 'Inverter Popup', [
        picker('inv_temp', 'Inverter Temp'),
        picker('inv_rad_temp', 'Rad Temp', true),
        picker('inv_error_entity', 'Error Entity', true),
        picker('inv_mode_entity', 'Mode Entity', true),
        picker('inv_total_hours', 'Total Hours', true),
        divider(),
        picker('inv_dod_on_grid', 'DoD On-grid', true),
        picker('inv_dod_off_grid', 'DoD Off-grid', true),
        picker('inv_export_limit', 'Export Limit', true),
      ], { toggleKey: '_show_system', toggleOn: showSystem, hidden: !showSystem }),
      divider(),
      makeSection('mon_battery_popup', '🔋', 'Battery Popup', [
        picker('bat_soh', 'SOH', true),
        picker('bat_index', 'Index', true),
        picker('bat_bms_version', 'BMS Version', true),
        picker('bat_status', 'Battery Status', true),
        picker('bat_cell_max_temp', 'Cell Max Temp', true),
        picker('bat_cell_min_temp', 'Cell Min Temp', true),
      ], { toggleKey: '_show_system', toggleOn: showSystem, hidden: !showSystem }),
      divider(),
      makeSection('mon_plugs', '🔌', 'Smart Plugs', [
        textField('smart_plug_1_name', 'Plug 1 Name', 'Plug 1'),
        picker('smart_plug_1_entity', 'Plug 1 Entity', true),
        picker('smart_plug_1_power', 'Plug 1 Power', true),
        picker('smart_plug_1_voltage', 'Plug 1 Voltage', true),
        picker('smart_plug_1_current', 'Plug 1 Current', true),
        divider(),
        textField('smart_plug_2_name', 'Plug 2 Name', 'Plug 2'),
        picker('smart_plug_2_entity', 'Plug 2 Entity', true),
        picker('smart_plug_2_power', 'Plug 2 Power', true),
        picker('smart_plug_2_voltage', 'Plug 2 Voltage', true),
        picker('smart_plug_2_current', 'Plug 2 Current', true),
      ], { toggleKey: '_show_smartplugs', toggleOn: showPlugs, hidden: !showPlugs }),
      divider(),
      makeSection('mon_climate', '🌡️', 'Climate', [
        textField('clim_ac_name', 'AC / Climate Name', 'AC'),
        picker('climate_entity', 'Climate Entity', true),
      ], { toggleKey: '_show_climate', toggleOn: showClimate, hidden: !showClimate }),
      divider(),
      makeSection('mon_rooms', '🏠', 'Room Sensors', [
        textField('room_1_name', 'Room 1 Name', 'Room 1'),
        picker('room_1_temp', 'Room 1 Temp', true),
        picker('room_1_humidity', 'Room 1 Humidity', true),
        picker('room_1_battery', 'Room 1 Battery', true),
        divider(),
        textField('room_2_name', 'Room 2 Name', 'Room 2'),
        picker('room_2_temp', 'Room 2 Temp', true),
        picker('room_2_humidity', 'Room 2 Humidity', true),
        picker('room_2_battery', 'Room 2 Battery', true),
      ], { toggleKey: '_show_rooms', toggleOn: showRooms, hidden: !showRooms }),
      divider(),
      makeSection('mon_fridge', '🧊', 'Fridge', [
        textField('fridge_name', 'Fridge Name', 'FRIDGE'),
        picker('fridge_current_temp', 'Fridge Current Temp', true),
        picker('fridge_set_temp', 'Fridge Set Temp', true),
        picker('freezer_current_temp', 'Freezer Current Temp', true),
        picker('freezer_set_temp', 'Freezer Set Temp', true),
        picker('fridge_mode', 'Fridge Mode', true),
        picker('fridge_door', 'Fridge Door (binary_sensor)', true),
        picker('freezer_door', 'Freezer Door (binary_sensor)', true),
      ], { toggleKey: '_show_fridge', toggleOn: showFridge, hidden: !showFridge }),
    ]));

    shell.appendChild(makeSection('ev', '🚗', 'EV / Car Charger', [
      picker('charger_state',           'Charger State'),
      picker('charger_power',           'Charger Power'),
      picker('charger_current',         'Charger Current'),
      picker('charger_soc',             'Car Battery SOC'),
      picker('charger_eta',             'Charge ETA (min)', true),
      numberField('charger_battery_capacity_wh', 'EV Battery Capacity', 0, 200000, 1, 'Wh'),
    ], { toggleKey: '_show_ev', toggleOn: showEV, hidden: !showEV }));

    // ── "Add or Customize Tiles" — 6 built-in tile dropdowns + Extra Tiles subsection ──
    const extraTilesEnabled = !!(cfg._show_extra_tiles);

    // Build the 6 built-in customizable tile dropdowns
    const builtInTileRows = [];

    const builtInTiles = [
      { id: 'cell_temp',   label: 'Cell Temp',   textKey: 'label_cell_temp_minmax', def: 'CELL TEMP',   entityKey: 'label_entity_cell_temp',   active: cellTempActive },
      { id: 'bms_temp',    label: 'BMS Temp',    textKey: 'label_bms_temp',         def: 'BMS TEMP',    entityKey: 'label_entity_bms_temp',    active: bmsTempActive  },
      { id: 'pv_voltage',  label: 'PV Voltage',  textKey: 'label_pv_voltage',       def: 'PV VOLTAGE',  entityKey: 'label_entity_pv_voltage',  active: pvVoltActive   },
      { id: 'cell_volt',   label: 'Cell Volt',   textKey: 'label_cell_volt',        def: 'CELL VOLT',   entityKey: 'label_entity_cell_volt',   active: minCellActive && maxCellActive },
      { id: 'remaining',   label: 'Remaining',   textKey: 'label_remaining',        def: 'REMAINING',   entityKey: 'label_entity_remaining',   active: remainActive   },
      { id: 'today_load',  label: 'Today Load',  textKey: 'label_today_load',       def: 'TODAY LOAD',  entityKey: 'label_entity_today_load',  active: _labelChanged('label_today_load', 'TODAY LOAD') },
    ];

    builtInTiles.forEach(tile => {
      const tileSection = makeSection(
        `tile_builtin_${tile.id}`,
        '🔲',
        tile.label,
        [ labelRow(tile.textKey, tile.label + ' label', tile.def, tile.entityKey, tile.active) ],
        {}
      );
      builtInTileRows.push(tileSection);
    });

    // ── 4 Inverter tile customization rows ──
    const inverterTiles = [
      { id: 'today_pv',     label: 'Today PV',     textKey: 'label_today_pv',     def: 'TODAY PV',     entityKey: 'label_entity_today_pv',     active: _labelChanged('label_today_pv',     'TODAY PV')     },
      { id: 'chg_dis',      label: 'Chg / Dis',    textKey: 'label_chg_dis',      def: 'CHG / DIS',    entityKey: 'label_entity_chg_dis',      active: _labelChanged('label_chg_dis',      'CHG / DIS')    },
      { id: 'grid_import',  label: 'Grid Import',  textKey: 'label_grid_import',  def: 'GRID IMPORT',  entityKey: 'label_entity_grid_import',  active: _labelChanged('label_grid_import',  'GRID IMPORT')  },
      { id: 'grid_export',  label: 'Grid Export',  textKey: 'label_grid_export',  def: 'GRID EXPORT',  entityKey: 'label_entity_grid_export',  active: _labelChanged('label_grid_export',  'GRID EXPORT')  },
    ];

    const inverterTileRows = [];
    inverterTiles.forEach(tile => {
      const tileSection = makeSection(
        `tile_inv_${tile.id}`,
        '📊',
        tile.label,
        [ labelRow(tile.textKey, tile.label + ' label', tile.def, tile.entityKey, tile.active) ],
        {}
      );
      inverterTileRows.push(tileSection);
    });

    // Build extra tile dropdowns
    const extraTileRows = [];
    for (let i = 1; i <= 6; i++) {
      const enabledKey  = `_extra_tile_${i}_enabled`;
      const labelKey    = `_extra_tile_${i}_label`;
      const entityKey   = `_extra_tile_${i}_entity`;
      const iconKey     = `_extra_tile_${i}_icon`;
      const labelSzKey  = `_extra_tile_${i}_label_size`;
      const valueSzKey  = `_extra_tile_${i}_value_size`;
      const tileOn      = !!(cfg[enabledKey]);

      const tileSection = makeSection(
        `extra_tile_${i}`,
        tileOn ? '✅' : '⬜',
        `Extra Tile ${i}`,
        [
          textField(labelKey,   'Label text',   `Tile ${i}`),
          textField(iconKey,    'Icon (emoji)',  '⚡'),
          (() => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin-bottom:14px;';
            const entityLabel = document.createElement('div');
            entityLabel.style.cssText = 'font-size:.72rem;color:var(--secondary-text-color);padding:0 2px 4px;line-height:1;';
            entityLabel.textContent = 'Entity';
            const currentId = cfg[entityKey];
            if (currentId && this._hass && this._hass.states[currentId]) {
              const stateVal = this._hass.states[currentId].state;
              const badge = document.createElement('span');
              badge.textContent = ' → ' + stateVal;
              badge.style.cssText = 'font-size:.65rem;font-weight:650;color:var(--primary-color,#03a9f4);';
              entityLabel.appendChild(badge);
            }
            const sel = document.createElement('ha-selector');
            sel.hass = this._hass;
            sel.selector = { entity: {} };
            sel.value = cfg[entityKey] || '';
            sel.style.cssText = 'width:100%;display:block;';
            sel.addEventListener('value-changed', (ev) => { ev.stopPropagation(); this._set(entityKey, ev.detail.value || ''); });
            wrap.appendChild(entityLabel);
            wrap.appendChild(sel);
            return wrap;
          })(),
          (() => {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
            grid.appendChild(numberField(labelSzKey, 'Label size (rem)', 0.3, 3.0, 0.01));
            grid.appendChild(numberField(valueSzKey, 'Value size (rem)',  0.3, 3.0, 0.01));
            return grid;
          })(),
        ],
        { toggleKey: enabledKey, toggleOn: tileOn, hidden: !tileOn }
      );
      extraTileRows.push(tileSection);
    }

    // Build the extra tiles subsection
    const extraTilesSubSection = makeSection('extra_tiles', '🔧', 'Extra Tiles',
      extraTileRows,
      { toggleKey: '_show_extra_tiles', toggleOn: extraTilesEnabled, hidden: !extraTilesEnabled }
    );

    // Build inverter tiles subsection
    const inverterTilesSubSection = makeSection('inv_tiles', '🔄', 'Inverter Tiles (4)',
      inverterTileRows, {}
    );

    shell.appendChild(makeSection('customize', '🎨', 'Add or Customize Tiles', [
      labelInfoBanner,
      ...builtInTileRows,
      divider(),
      inverterTilesSubSection,
      divider(),
      extraTilesSubSection,
    ], { toggleKey: '_labels_custom_entities', toggleOn: labelsEnabled, hidden: !labelsEnabled }));

    // ── Tile Font Sizes — always visible, controls _applyTileSize in _updateDynamic ──
    shell.appendChild(makeSection('tile_sizes', '🔤', 'Tile Font Sizes', [
      (() => {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:.72rem;line-height:1.5;color:var(--secondary-text-color);background:var(--secondary-background-color,rgba(0,0,0,.04));border:1px solid var(--divider-color,rgba(0,0,0,.10));border-radius:7px;padding:7px 10px;margin-bottom:10px;';
        info.textContent = '🔤 Set to 0 to use the default size. Values in rem (e.g. 0.56 for label, 0.95 for value).';
        return info;
      })(),
      (() => {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
        const tiles = [
          ['label_cell_temp_size',  'Cell Temp Label'],    ['val_cell_temp_size',   'Cell Temp Value'],
          ['label_bms_temp_size',   'BMS Temp Label'],     ['val_bms_temp_size',    'BMS Temp Value'],
          ['label_cell_volt_size',  'Cell Volt Label'],    ['val_cell_volt_size',   'Cell Volt Value'],
          ['label_remaining_size',  'Remaining Label'],    ['val_remaining_size',   'Remaining Value'],
          ['label_today_load_size', 'Today Load Label'],   ['val_today_load_size',  'Today Load Value'],
          ['label_grid_import_size','Grid Import Label'],  ['val_grid_import_size', 'Grid Import Value'],
          ['label_endurance_size',  'Endurance Label'],    ['val_endurance_size',   'Endurance Value'],
          ['label_today_pv_size',   'Today PV Label'],     ['val_today_pv_size',    'Today PV Value'],
          ['label_chg_dis_size',    'Chg / Dis Label'],    ['val_chg_dis_size',     'Chg / Dis Value'],
        ];
        tiles.forEach(([key, label]) => grid.appendChild(numberField(key, label, 0, 3.0, 0.01, 'rem')));
        return grid;
      })(),
    ]));

    shell.appendChild(makeSection('thresholds', '⚡', 'Thresholds', [
      (() => {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:.72rem;line-height:1.5;color:var(--secondary-text-color);background:var(--secondary-background-color,rgba(0,0,0,.04));border:1px solid var(--divider-color,rgba(0,0,0,.10));border-radius:7px;padding:7px 10px;margin-bottom:10px;';
        info.textContent = '⚡ When a value exceeds these thresholds, it turns amber (warn) or red (critical). Threshold color always overrides user color.';
        return info;
      })(),
      numberField('thresh_temp_warn',       'Temp Warn',        0, 200, 1, '°C'),
      numberField('thresh_temp_critical',   'Temp Critical',    0, 200, 1, '°C'),
      divider(),
      numberField('thresh_cell_v_low',      'Cell V Low',       0, 5,   0.01, 'V'),
      numberField('thresh_cell_v_critical', 'Cell V Critical',  0, 5,   0.01, 'V'),
      numberField('thresh_cell_v_high',     'Cell V High',      0, 5,   0.01, 'V'),
      divider(),
      numberField('thresh_soc_low',         'SOC Low',          0, 100, 1, '%'),
      numberField('thresh_soc_critical',    'SOC Critical',     0, 100, 1, '%'),
      divider(),
      numberField('thresh_load_warn',       'Load Warn',        0, 100, 1, '%'),
      numberField('thresh_load_critical',   'Load Critical',    0, 100, 1, '%'),
      divider(),
      numberField('thresh_endurance_low',   'Endurance Low',    0, 24,  0.5, 'h'),
      numberField('thresh_endurance_crit',  'Endurance Crit',   0, 24,  0.5, 'h'),
    ]));

    this.innerHTML = '';
    this.appendChild(shell);
    this._rendered = true; // Fix #2: mark rendered so hass setter stops triggering full DOM rebuilds
  }
}
customElements.define('zee-skycard-editor', ZeeSkyCardEditor);

// ═══════════════════════════════════════════════════════════════
// MAIN CARD
// ═══════════════════════════════════════════════════════════════
class ZeeSkyCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this.config = {};
    this._prevPvTotal = -1;
    this._prevSunPos = { bx: -1, by: -1 };
    this._prevPvBlocksKey = '';
    this._prevSkyKey  = null;
    this._prevMoonPhase = -1;  // cache: rebuild SVG only when phase changes meaningfully
    this._prevPvTier = -1;     // cache: wave rebuild only on tier boundary, not every watt change
    this._prevPvWaveBx = -1;
    this._prevPvWaveBy = -1;
    this._pvSlot = 'A';         // double-buffer: A/B swap eliminates 1-frame gap on wave rebuild
    this._skySlot     = 'A';
    this.attachShadow({ mode: 'open' });
  }

  // Read weather condition from HA weather entity.
  // Auto-detects Met.no / Open-Meteo common entity IDs so the card works
  // out of the box without any manual configuration.
  _wxCondition() {
    // Candidate entity IDs � tries in order, uses first that exists in HA states
    const candidates = [
      this.config.weather_entity,          // user-configured (default: weather.home)
      'weather.home',                       // Met.no standard
      'weather.forecast_home',             // Met.no alternate
      'weather.home_hourly',               // Met.no hourly
      'weather.home_daily',                // Met.no daily
      'weather.open_meteo',                // Open-Meteo
      'weather.openweathermap',            // OpenWeatherMap
    ].filter(Boolean);

    let state = null;
    for (const eid of candidates) {
      const s = this._hass?.states[eid];
      if (s && s.state && s.state !== 'unavailable' && s.state !== 'unknown') {
        state = s.state.toLowerCase().replace(/-/g, '');
        break;
      }
    }
    if (!state) return 'clear'; // no weather entity found � default to clear

    if (state.includes('thunder') || state.includes('lightning'))                    return 'thunderstorm';
    if (state.includes('snow')    || state.includes('sleet') || state.includes('hail')) return 'snowy';
    if (state.includes('rain')    || state.includes('drizzle') || state.includes('shower')) return 'rainy';
    if (state.includes('fog')     || state.includes('mist') || state.includes('haze'))  return 'fog';
    if (state.includes('cloud')   || state.includes('overcast')) {
      return (state.includes('partly') || state.includes('few') || state.includes('scattered'))
        ? 'partlycloudy' : 'cloudy';
    }
    return 'clear';
  }

  static getStubConfig() {
    return {
      pv1_power: 'sensor.goodwe_pv1_power',
      pv2_power: 'sensor.goodwe_pv2_power',
      pv3_power: '',
      pv4_power: '',
      pv_total_power: 'sensor.goodwe_pv_power',
      grid_active_power: 'sensor.goodwe_active_power',
      consump: 'sensor.goodwe_house_consumption',
      today_pv: 'sensor.goodwe_today_s_pv_generation',
      today_batt_chg: 'sensor.goodwe_today_battery_charge',
      today_load: 'sensor.goodwe_today_load',
      battery_soc: 'sensor.jk_soc',
      battery_power: 'sensor.jk_power',
      battery_current: 'sensor.jk_current',
      battery_voltage: 'sensor.jk_voltage',
      battery_temp1: 'sensor.jk_temp1',
      battery_temp2: 'sensor.jk_temp2',
      battery_mos: 'sensor.jk_mos',
      battery_min_cell: 'sensor.jk_cellmin',
      battery_max_cell: 'sensor.jk_cellmax',
      goodwe_battery_soc: 'sensor.goodwe_battery_state_of_charge',
      goodwe_battery_curr: 'sensor.goodwe_battery_current',
      inv_temp: 'sensor.goodwe_inverter_temperature_module',
      batt_dis: 'sensor.goodwe_today_battery_discharge',
      battery2_soc: '',
      battery2_power: '',
      battery2_current: '',
      battery2_voltage: '',
      battery2_mos: '',
      battery_full_ah: 0,
      battery_full_wh: 0,
      battery_cap_unit: 'ah',
      battery2_full_ah: 0,
      battery2_full_wh: 0,
      inverter_max_power: 6000,
      pv_max_power: 7500,
      lower_section_offset: 0,   // SVG units — negative = move up, positive = move down
      charger_state: '',
      charger_current: '',
      charger_power: '',
      charger_soc: '',
      charger_eta: '',
      charger_battery_capacity_wh: 0,
      sun: 'sun.sun',           // always auto-resolved; kept for YAML compat only
      weather_entity: 'weather.home',
      inverter_name: '',
      label_cell_temp_minmax: 'CELL TEMP',
      label_bms_temp: 'BMS TEMP',
      label_endurance: 'ENDURANCE',
      label_cell_volt: 'CELL VOLT',
      label_remaining: 'REMAINING',
      label_pv_voltage: 'PV VOLTAGE',
      label_today_pv: 'TODAY PV',
      label_chg_dis: 'CHG / DIS',
      label_grid_import: 'GRID IMPORT',
      label_grid_export: 'GRID EXPORT',
      label_today_load: 'TODAY LOAD',
      label_today_batt_charge: 'CHARGE',
      label_today_batt_discharge: 'DISCHARGE',
      // Custom entity overrides for 6 stat tiles
      label_entity_cell_temp: '',
      label_entity_bms_temp: '',
      label_entity_cell_volt: '',
      label_entity_pv_voltage: '',
      label_entity_remaining: '',
      label_entity_today_load: '',
      // Custom entity overrides for 4 inverter tiles
      label_entity_today_pv: '',
      label_entity_chg_dis: '',
      label_entity_grid_import: '',
      label_entity_grid_export: '',
      _labels_custom_entities: false,
      // PV voltage entities
      pv1_voltage: 'sensor.goodwe_pv1_voltage',
      pv2_voltage: 'sensor.goodwe_pv2_voltage',
      pv3_voltage: '',
      pv4_voltage: '',
      // Grid import today
      grid_import_today: 'sensor.goodwe_today_energy_import',
      grid_export_today: 'sensor.goodwe_today_energy_export',
      grid_power_alt: 'sensor.grid_phase_a_power',
      grid_voltage: '',
      grid_frequency: '',
      load_voltage: '',
      _show_3phase: false,
      grid_phase_a: '',
      grid_phase_b: '',
      grid_phase_c: '',
      grid_phase_a_volt: '',
      grid_phase_b_volt: '',
      grid_phase_c_volt: '',
      _show_inv_banner: true,
      _show_battery: true,
      _show_battery2: false,
      invert_battery_power: false,
      invert_grid_power: false,
      _show_pv_extra: false,
      _show_ev: false,
      // Per-tile sizes (0 = use global/CSS default)
      label_cell_temp_size: 0,     val_cell_temp_size: 0,
      label_bms_temp_size: 0,      val_bms_temp_size: 0,
      label_cell_volt_size: 0,     val_cell_volt_size: 0,
      label_remaining_size: 0,     val_remaining_size: 0,
      label_today_load_size: 0,    val_today_load_size: 0,
      label_grid_import_size: 0,   val_grid_import_size: 0,
      label_endurance_size: 0,     val_endurance_size: 0,
      label_today_pv_size: 0,      val_today_pv_size: 0,
      label_chg_dis_size: 0,       val_chg_dis_size: 0,
      // Extra Tiles (6 customizable)
      _show_extra_tiles: false,
      _extra_tile_1_enabled: false, _extra_tile_1_label: '', _extra_tile_1_entity: '', _extra_tile_1_icon: '⚡', _extra_tile_1_label_size: 0, _extra_tile_1_value_size: 0,
      _extra_tile_2_enabled: false, _extra_tile_2_label: '', _extra_tile_2_entity: '', _extra_tile_2_icon: '📊', _extra_tile_2_label_size: 0, _extra_tile_2_value_size: 0,
      _extra_tile_3_enabled: false, _extra_tile_3_label: '', _extra_tile_3_entity: '', _extra_tile_3_icon: '🌡️', _extra_tile_3_label_size: 0, _extra_tile_3_value_size: 0,
      _extra_tile_4_enabled: false, _extra_tile_4_label: '', _extra_tile_4_entity: '', _extra_tile_4_icon: '💡', _extra_tile_4_label_size: 0, _extra_tile_4_value_size: 0,
      _extra_tile_5_enabled: false, _extra_tile_5_label: '', _extra_tile_5_entity: '', _extra_tile_5_icon: '🔌', _extra_tile_5_label_size: 0, _extra_tile_5_value_size: 0,
      _extra_tile_6_enabled: false, _extra_tile_6_label: '', _extra_tile_6_entity: '', _extra_tile_6_icon: '📡', _extra_tile_6_label_size: 0, _extra_tile_6_value_size: 0,
      // Thresholds
      thresh_temp_warn: 40, thresh_temp_critical: 50,
      thresh_cell_v_low: 3.1, thresh_cell_v_critical: 3.0, thresh_cell_v_high: 3.65,
      thresh_soc_low: 25, thresh_soc_critical: 15,
      thresh_load_warn: 70, thresh_load_critical: 90,
      thresh_endurance_low: 2, thresh_endurance_crit: 1,
      // ── Monitoring section ──
      _show_camera: false,
      camera_1_entity: '', camera_1_name: 'Camera 1',
      camera_2_entity: '', camera_2_name: 'Camera 2',
      camera_3_entity: '', camera_3_name: 'Camera 3',
      camera_4_entity: '', camera_4_name: 'Camera 4',
      _show_system: false,
      _show_smartplugs: false,
      smart_plug_1_entity: '', smart_plug_1_name: 'Plug 1', smart_plug_1_power: '', smart_plug_1_voltage: '', smart_plug_1_current: '',
      smart_plug_2_entity: '', smart_plug_2_name: 'Plug 2', smart_plug_2_power: '', smart_plug_2_voltage: '', smart_plug_2_current: '',
      _show_climate: false,
      climate_entity: '', clim_ac_name: 'AC',
      _show_rooms: false,
      room_1_name: 'Room 1', room_1_temp: '', room_1_humidity: '', room_1_battery: '',
      room_2_name: 'Room 2', room_2_temp: '', room_2_humidity: '', room_2_battery: '',
      _show_fridge: false,
      fridge_name: 'FRIDGE',
      fridge_current_temp: '', fridge_set_temp: '', freezer_current_temp: '', freezer_set_temp: '',
      fridge_mode: '', fridge_door: '', freezer_door: '',
      // ── System monitoring entities ──
      sys_cpu_entity: '',
      sys_mem_entity: '',
      sys_disk_entity: '',
      sys_uptime_entity: 'sensor.uptime',
      sys_core1_temp: '',
      sys_core2_temp: '',
      sys_package_temp: '',
      sys_eth0_rx: '',
      sys_eth0_tx: '',
      sys_wlan0_rx: '',
      sys_wlan0_tx: '',
      total_load_entity: '',
      total_pv: '',
      total_batt_chg: '',
      total_batt_dis: '',
      grid_import_total: '',
      grid_export_total: '',
      // ── Inverter monitoring entities ──
      inv_rad_temp: '',
      inv_total_hours: '',
      // inv_max_power_entity removed — use inverter_max_power directly
      inv_error_entity: '',
      inv_mode_entity: '',
      inv_dod_on_grid: '',
      inv_dod_off_grid: '',
      inv_export_limit: '',
      // ── Battery monitoring entities ──
      bat_soh: '',
      bat_index: '',
      bat_bms_version: '',
      bat_status: '',
      bat_cell_max_temp: '',
      bat_cell_min_temp: '',
    };
  }

  getCardSize() { return 8; }
  static getConfigElement() { return document.createElement('zee-skycard-editor'); }

  setConfig(config) {
    const prev = this.config;
    this.config = { ...ZeeSkyCard.getStubConfig(), ...config };
    // Migrate old label defaults to new ones
    if (this.config.label_cell_temp_minmax === 'CELL TEMP MIN/MAX') this.config.label_cell_temp_minmax = 'CELL TEMP';
    // Only rebuild the full DOM when structural keys change (toggles, labels rendered in HTML).
    // Entity-only changes must NOT rebuild — that causes HA "configuration error" flash.
    const STRUCTURAL_KEYS = [
      '_show_battery','_show_battery2','_show_pv_extra','_show_ev','_show_3phase',
      '_show_extra_tiles','battery_cap_unit','_show_inv_banner',
      '_show_camera','camera_1_name','camera_2_name','camera_3_name','camera_4_name',
      '_show_system','_show_smartplugs','smart_plug_1_name','smart_plug_2_name',
      '_show_climate','clim_ac_name',
      '_show_rooms','room_1_name','room_2_name',
      '_show_fridge','fridge_name',
      'label_cell_temp_minmax','label_bms_temp','label_cell_volt',
      'label_pv_voltage','label_remaining','label_endurance',
      'label_today_pv','label_chg_dis','label_grid_import','label_grid_export','label_today_load',
      'label_entity_cell_temp','label_entity_cell_volt',
      'inverter_name',
    ];
    // Extra tile label/icon/enable/size keys are baked into innerHTML — treat as structural.
    // _entity keys are excluded: those are dynamic sensor reads, not structural HTML.
    const extraTileChanged = !!prev && Object.keys(this.config).some(
      k => k.startsWith('_extra_tile_') && !k.endsWith('_entity') && this.config[k] !== prev[k]
    );
    const needsRebuild = !prev || extraTileChanged || STRUCTURAL_KEYS.some(k => this.config[k] !== prev[k]);
    if (needsRebuild) this._buildStaticSVG();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateDynamic();
    const sun = this._sunData();
    this._renderSky(sun, this._wxCondition());
  }

  _val(eid, toWatts = false) {
    if (!eid) return null;
    const s = this._hass?.states?.[eid];
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const v = parseFloat(s.state);
    if (isNaN(v)) return null;
    if (toWatts) {
      const unit = (s.attributes?.unit_of_measurement || '').trim();
      if (unit === 'kW' || unit === 'kilowatt') return v * 1000;
    }
    return v;
  }

  _strVal(eid) {
    if (!eid) return '';
    const s = this._hass?.states?.[eid];
    if (!s) return '';
    return String(s.state).toLowerCase().trim();
  }

  _socColor(p) { return p<=25?'#f85149':p<=50?'#f39c4b':p<=75?'#58a6ff':'#4CAF50'; }
  _cellTempColor(t) { return t<=15?'#58a6ff':t<=35?'#3fb950':t<=45?'#f0883e':'#f85149'; }
  _cellVoltColor(v) { if(v<=0.001)return'#8b949e'; if(v<3.0)return'#f85149'; if(v<3.1)return'#f39c4b'; if(v<3.4)return'#f4d03f'; if(v<=3.65)return'#3fb950'; return'#f85149'; }
  _tempColor(t) { return t<=25?'#3fb950':t<=45?'#f0883e':'#f85149'; }
  _remCapColor(p) { return p<=15?'#e34d4c':p<=30?'#f39c4b':p<=55?'#f4d03f':'#2ecc71'; }
  _fmtTime(h) { if(!isFinite(h)||h<=0) return'--';const hh=Math.floor(h),mm=Math.round((h-hh)*60);return hh+'h '+(mm<10?'0':'')+mm+'m'; }
  _fmtEndurance(h) {
    if (!isFinite(h) || h < 0) return '--';
    const days = Math.floor(h / 24), hrs = Math.floor(h % 24), mins = Math.floor((h - Math.floor(h)) * 60);
    if (days > 0) return days + 'd ' + hrs + 'h';
    return hrs + 'h ' + (mins < 10 ? '0' : '') + mins + 'm';
  }
  _fmtTill(h) {
    // Fix #15: h > 0 guard was too strict � h approaching 0 from positive side
    // (battery at 0%, tiny charge power) returned 'Till --' despite a valid ETA.
    // Use h < 0 to reject only truly invalid/negative values.
    if (!isFinite(h) || h < 0) return 'Till --';
    const target = new Date(Date.now() + h * 3600000);
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][target.getDay()];
    let hr = target.getHours(); const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    return 'Till ' + day + ' ' + hr + ':' + target.getMinutes().toString().padStart(2,'0') + ' ' + ampm;
  }
  _fmtDuration(sec) {
    // Compact zero-padded uptime: e.g. "03D 05H 09M"
    sec = Math.max(0, Math.floor(sec));
    const days = Math.floor(sec / 86400);
    const hrs = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const p = n => String(n).padStart(2, '0');
    return p(days) + 'D ' + p(hrs) + 'H ' + p(mins) + 'M';
  }
  _fmtUptime(raw) {
    if (!raw) return '--';
    const s = String(raw).trim();
    // Numeric — could be seconds since boot (<10 digits) or Unix timestamp (>=10 digits)
    if (/^\d+(\.\d+)?$/.test(s)) {
      const num = parseFloat(s);
      if (s.length >= 10) {
        const ms = num * (s.length <= 10 ? 1000 : 1);
        return this._fmtDuration(Math.max(0, Math.floor((Date.now() - ms) / 1000)));
      }
      return this._fmtDuration(num);
    }
    // Date string — strip "at", "T", etc.
    const clean = s.replace(/\s+at\s+/gi, ' ').replace('T', ' ');
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return this._fmtDuration(Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)));
    return s;
  }
  _fmtNetwork(val) {
    if (val === null || val === undefined || !isFinite(val)) return '--';
    if (val === 0) return '0 B/s';
    const units = ['', 'K', 'M', 'G', 'T'];
    let idx = 0, v = Math.abs(val);
    while (v >= 1000 && idx < units.length - 1) { v /= 1000; idx++; }
    const s = val < 0 ? '-' : '';
    if (v < 0.01) return s + (v * 1000).toFixed(2) + ' m' + units[idx] + 'B/s';
    if (v < 1) return s + v.toFixed(3) + ' ' + units[idx] + 'B/s';
    if (v < 10) return s + v.toFixed(2) + ' ' + units[idx] + 'B/s';
    if (v < 100) return s + v.toFixed(1) + ' ' + units[idx] + 'B/s';
    return s + v.toFixed(0) + ' ' + units[idx] + 'B/s';
  }
 
  _sunData() {
    const attrs = this._hass?.states[this.config.sun || 'sun.sun']?.attributes;
    // Sun position uses time-based t derived from today's ACTUAL rise/set times.
    // next_rising/next_setting flip to tomorrow after sunrise � we correct for this
    // by subtracting one day when the event is more than 18 h in the future.
    // elevation is used only for night detection and bell (arc height) � it is a
    // live real-time value and is never affected by the tomorrow-flip problem.
    let rise = '06:00', set = '18:00';
    let t = 0.5;
    let night = false;
    let bell = 0.5;

    // Return the nearest occurrence (today's) of an HA future-only ISO timestamp.
    // HA next_rising/next_setting are always in the future; after the event passes today
    // they flip to tomorrow. We detect this by checking if the event is > 18 h away �
    // if so, we step back one calendar day in LOCAL time (not UTC) to recover today's time.
    const nearestTime = iso => {
      if (!iso) return null;
      try {
        const future = new Date(iso);
        if ((future - Date.now()) > 18 * 3600000) {
          // Step back one day while preserving the exact local clock time
          future.setDate(future.getDate() - 1);
        }
        // Return local HH:MM (correct for user's timezone)
        return String(future.getHours()).padStart(2, '0') + ':' + String(future.getMinutes()).padStart(2, '0');
      } catch (e) { return null; }
    };

    if (attrs) {
      // Get today's actual rise / set for display labels AND position math
      rise = nearestTime(attrs.next_rising)  || rise;
      set  = nearestTime(attrs.next_setting) || set;

      const toMin = ts => { const p = ts.split(':').map(Number); return p[0] * 60 + p[1]; };
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const RISE = toMin(rise), SET = toMin(set);
      const dayLen = SET - RISE;

      // t: 0 = sunrise, 1 = sunset, clamped to [0,1]
      t = dayLen > 0 ? Math.max(0, Math.min(1, (nowMin - RISE) / dayLen)) : 0.5;

      // Night detection: prefer live elevation when available
      if (attrs.elevation != null) {
        night = parseFloat(attrs.elevation) < 0;
        // bell: how high the sun is (0 at horizon, 1 at max elevation)
        bell = Math.max(0, Math.sin(Math.max(0, parseFloat(attrs.elevation)) * Math.PI / 180));
      } else {
        night = nowMin < RISE || nowMin > SET;
        bell  = 1 - Math.pow(Math.abs(2 * t - 1), 1.5);
      }
    }

    // Sun position: left(42,161) → top(260,54) → right(472,161)
    const bx = Math.round((1 - t) * (1 - t) * 42 + 2 * (1 - t) * t * 260 + t * t * 472);
    const by = Math.round((1 - t) * (1 - t) * 161 + 2 * (1 - t) * t * 54 + t * t * 161);


    // Moon travels same arc right→left during night
    let mx = 260, my = 161;
    if (night) {
      const toMin2 = ts => { const p = ts.split(':').map(Number); return p[0] * 60 + p[1]; };
      const RISE2 = toMin2(rise), SET2 = toMin2(set);
      const nowMin2 = new Date().getHours() * 60 + new Date().getMinutes();
      const dayLen2 = SET2 > RISE2 ? SET2 - RISE2 : 0;
      const nightLen = Math.max(1, 1440 - dayLen2);
      let tMoon = nowMin2 >= SET2
        ? (nowMin2 - SET2) / nightLen
        : (nowMin2 + 1440 - SET2) / nightLen;
      tMoon = Math.max(0, Math.min(1, tMoon));
    // Moon direction: rises east (right side at sunset), sets west (left side at sunrise)
    // tMoon=0 = just after sunset (right/east horizon), tMoon=1 = just before sunrise (left/west horizon)
      mx = Math.round((1 - tMoon) * (1 - tMoon) * 500 + 2 * (1 - tMoon) * tMoon * 260 + tMoon * tMoon * 42);
      my = Math.round((1 - tMoon) * (1 - tMoon) * 161 + 2 * (1 - tMoon) * tMoon * 85 + tMoon * tMoon * 161);
    }
    return { rise, set, night, bell, bx, by, mx, my, t };
  }

  _battFill(soc){
    const ft=138,fb=269,fh=131;const fH=Math.round((soc||0)/100*fh),fY=fb-fH;let c,f,tc;
    const thresh_critical = Number(this.config?.thresh_soc_critical) || 15;
    const thresh_warn     = Number(this.config?.thresh_soc_low)      || 25;
    if(soc<=thresh_critical){ c='#ef4444'; f='url(#battGlowRed)';    tc='#fff'; }
    else if(soc<=thresh_warn){ c='#f59e0b'; f='url(#battGlowOrange)'; tc='#000'; }
    else                     { c='#38bdf8'; f='url(#battGlowCyan)';   tc='#fff'; }
    if (soc < 40) tc = '#fff';
    return{y:fY,height:fH,color:c,filter:fH>4?f:'none',textColor:tc};
  }

  _flowLevel(w,type){
    if(type==='solar'){if(w<200)return{dur:4,size:1.8,count:6};if(w<600)return{dur:3.2,size:2.2,count:12};if(w<1200)return{dur:2.7,size:2.5,count:20};if(w<2500)return{dur:2.4,size:2.8,count:30};if(w<4000)return{dur:1.8,size:3.2,count:42};if(w<6000)return{dur:1.2,size:3.5,count:55};return{dur:.9,size:3.8,count:65};}
    if(w<150)return{dur:4,size:1.8,count:4};if(w<500)return{dur:3.2,size:2.2,count:8};if(w<1000)return{dur:2.7,size:2.5,count:14};if(w<2000)return{dur:2.4,size:2.8,count:22};if(w<3000)return{dur:1.8,size:3.2,count:30};if(w<4500)return{dur:1.5,size:3.5,count:40};return{dur:.9,size:3.8,count:50};
  }

  _buildPvBlocksHTML(pvTotal, pvMax) {
    const N = 17;
    const max = Math.max(pvMax, 1);
    const lit = Math.min(N, Math.max(0, Math.round((pvTotal / max) * N)));
    const offCol = 'rgba(255,255,255,0.07)';
    let onCol = offCol;
    if (lit > 0) {
      if (lit <= 7) onCol = '#3fb950';
      else if (lit <= 13) onCol = '#29b6f6';
      else onCol = '#ffe83c';
    }
    let html = '';
    for (let i = 0; i < N; i++) {
      html += `<div class="kfc-pv-seg" style="background:${i < lit ? onCol : offCol}"></div>`;
    }
    return html;
  }

  _buildPvWaveHTML(bx,by,pvT){
    if(pvT<=10)return'';const fl=this._flowLevel(pvT,'solar');const sY=by+28;const cp1Y=by+70;const cp2Y=by+90;const pD='M '+bx.toFixed(1)+','+sY.toFixed(1)+' C '+bx.toFixed(1)+','+cp1Y.toFixed(1)+' 260,'+cp2Y.toFixed(1)+' 260,290';const col='rgba(255,232,60,.95)',gc='rgba(255,190,20,.55)';const dD=(fl.dur*.8).toFixed(2),dL=(8+fl.size*1.5).toFixed(1),gL=(6+fl.size*1.2).toFixed(1),dT=(parseFloat(dL)+parseFloat(gL)).toFixed(1);let h='';h+='<path d="'+pD+'" fill="none" stroke="'+gc+'" stroke-width="6" stroke-dasharray="'+dL+' '+gL+'" stroke-linecap="round" opacity="0.25" filter="url(#arcSunF2)"><animate attributeName="stroke-dashoffset" from="'+dT+'" to="0" dur="'+dD+'s" repeatCount="indefinite" calcMode="linear"/></path>';h+='<path d="'+pD+'" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-dasharray="'+dL+' '+gL+'" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="'+dT+'" to="0" dur="'+dD+'s" repeatCount="indefinite" calcMode="linear"/></path>';h+='<path d="'+pD+'" fill="none" stroke="'+col+'" stroke-width="1.0" stroke-dasharray="'+dL+' '+gL+'" stroke-linecap="round" opacity="0.85"><animate attributeName="stroke-dashoffset" from="'+dT+'" to="0" dur="'+dD+'s" repeatCount="indefinite" calcMode="linear"/></path>';const wD=[{amp:6,dur:fl.dur*.9,ox:0,op:.9,sc:'rgba(255,255,255,0.92)',dLen:'3.0',dGap:'40.0'},{amp:10,dur:fl.dur*1.1,ox:3,op:.6,sc:col,dLen:'4.5',dGap:'50.0'}];const wc=Math.min(2,Math.max(1,Math.round(fl.count/5)));for(let wi=0;wi<wc;wi++){const w=wD[wi];const sC=Math.round(fl.count*.5),sD=w.dur.toFixed(2),sCy=(parseFloat(w.dLen)+parseFloat(w.dGap)).toFixed(1);for(let si=0;si<sC;si++){const fr=si/sC,ph=fr*Math.PI*2,sY2=(w.amp*Math.sin(ph+wi*1.1)).toFixed(1),sX=(w.ox+w.amp*.3*Math.cos(ph*.5)).toFixed(1),sDe=(fr*w.dur%w.dur).toFixed(3),sO=(w.op*(.5+.5*Math.abs(Math.sin(ph)))*.6).toFixed(2);h+='<g transform="translate('+sX+','+sY2+')"><path d="'+pD+'" fill="none" stroke="'+w.sc+'" stroke-width="1.2" stroke-dasharray="'+w.dLen+' '+w.dGap+'" stroke-linecap="round" opacity="'+sO+'"><animate attributeName="stroke-dashoffset" from="'+sCy+'" to="0" dur="'+sD+'s" begin="-'+sDe+'s" repeatCount="indefinite" calcMode="linear"/></path></g>';}}return h;
  }

  _buildExtraTilesHTML() {
    const enabled = [];
    for (let i = 1; i <= 6; i++) {
      if (this.config[`_extra_tile_${i}_enabled`]) enabled.push(i);
    }
    if (!enabled.length) return '';

    // Split into rows of 3
    let html = '';
    for (let row = 0; row < Math.ceil(enabled.length / 3); row++) {
      const rowTiles = enabled.slice(row * 3, row * 3 + 3);
      html += `<div style="display:grid;grid-template-columns:repeat(${Math.min(rowTiles.length,3)},1fr);gap:8px;margin-top:8px">`;
      rowTiles.forEach(i => {
        const label  = this.config[`_extra_tile_${i}_label`] || `Tile ${i}`;
        const icon   = this.config[`_extra_tile_${i}_icon`]  || '⚡';
        const lSize  = Number(this.config[`_extra_tile_${i}_label_size`]) || 0;
        const vSize  = Number(this.config[`_extra_tile_${i}_value_size`]) || 0;
        // Only override font-size inline when explicitly set; otherwise let CSS vars take over
        const lStyle = lSize > 0 ? ` style="font-size:${lSize}rem"` : '';
        const vStyle = vSize > 0 ? ` style="color:#ffffff;font-size:${vSize}rem"` : ` style="color:#ffffff"`;
        html += `
        <div class="st">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:1.0rem;line-height:1;flex-shrink:0">${icon}</span>
            <div style="min-width:0">
              <div class="l"${lStyle}>${label}</div>
              <div class="v" id="bExtraTile${i}"${vStyle}>--</div>
            </div>
          </div>
        </div>`;
      });
      html += `</div>`;
    }
    return html;
  }

  // ── MONITORING: Camera stream URL ──
  _resolveCameraStream(entityId) {
    if (!entityId || !this._hass) return null;
    const state = this._hass.states[entityId];
    if (state?.attributes?.entity_picture) return state.attributes.entity_picture;
    return this._hass.hassUrl(`/api/camera_proxy_stream/${entityId.replace('.', '/')}`);
  }

  // ── MONITORING: Popup helpers ──
  _closePopup() {
    const ov = this._popupOverlay;
    if (ov) { ov.remove(); this._popupOverlay = null; }
  }

  _popup(html, opts = {}) {
    this._closePopup();
    const ov = document.createElement('div');
    ov._cardHost = this;
    ov.setAttribute('data-host', '');
    ov.onclick = (e) => { if (e.target === ov) this._closePopup(); };
    Object.assign(ov.style, {
      position:'fixed', inset:'0', zIndex:'9999', display:'flex',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)',
      WebkitBackdropFilter:'blur(8px)',
      fontFamily:'"Segoe UI",system-ui,-apple-system,sans-serif',
      animation:'kfcPopFadeIn .2s ease',
    });
    const bx = document.createElement('div');
    Object.assign(bx.style, {
      background:'rgba(15,23,42,0.82)', border:'1px solid rgba(255,255,255,0.10)',
      borderRadius:'18px', padding:'24px 26px', maxWidth: opts.maxWidth || '620px', width:'92%', margin:'5px',
      maxHeight:'88vh', overflowY:'auto', position:'relative',
      boxShadow:'0 16px 56px rgba(0,0,0,0.5)',
      backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      animation:'kfcPopFadeIn .25s ease',
    });
    bx.innerHTML = html;
    ov.appendChild(bx);
    document.body.appendChild(ov);
    this._popupOverlay = ov;
    const cb = bx.querySelector('[data-close]');
    if (cb) cb.onclick = () => this._closePopup();
    ov.addEventListener('click', (e) => {
      const item = e.target.closest('[data-eid]');
      if (item) {
        const eid = item.getAttribute('data-eid');
        if (eid) {
          window.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: eid } }));
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: eid }, bubbles: true, composed: true }));
        }
      }
    });
    // Inject keyframe once
    if (!document.getElementById('kfc-popup-kf')) {
      const st = document.createElement('style');
      st.id = 'kfc-popup-kf';
      st.textContent = '@keyframes kfcPopFadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}';
      document.head.appendChild(st);
    }
  }

  _popupClose() { return `<span data-close style="position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:1.2rem;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;line-height:1">&times;</span>`; }

  _popupTitle(t) { return `<div style="font-size:.82rem;font-weight:650;letter-spacing:2px;text-transform:uppercase;color:#f39c4b;margin-bottom:14px;display:flex;align-items:center;gap:8px">${t}</div>`; }

  _popupGrid(items) {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${items.join('')}</div>`;
  }

  _popupItem(label, value, vClr = '#e0e8f0') {
    return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 12px;text-align:center">
      <div style="font-size:.6rem;color:rgba(200,215,235,0.5);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px">${label}</div>
      <div style="font-size:1rem;font-weight:650;color:${vClr}">${value}</div></div>`;
  }
  _popupEntityItem(label, value, entityId, vClr = '#e0e8f0') {
    const eid = entityId || '';
    const click = eid ? ` onclick="const h=this.closest('[data-host]')._cardHost;h.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:'${eid}'},bubbles:true,composed:true}));window.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:'${eid}'}}))"` : '';
    return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 12px;text-align:center${eid ? ';cursor:pointer' : ''}"${click}>
      <div style="font-size:.6rem;color:rgba(200,215,235,0.5);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px">${label}</div>
      <div style="font-size:1rem;font-weight:650;color:${vClr}">${value}</div></div>`;
  }

  _openCameraPopup() {
    const cams = [];
    for (let i = 1; i <= 4; i++) {
      const eid = this.config[`camera_${i}_entity`];
      const name = this.config[`camera_${i}_name`] || `Camera ${i}`;
      const src = eid ? this._resolveCameraStream(eid) : null;
      cams.push({ name, src, eid });
    }
    this._cams = cams;
    let g = '';
    for (let i = 0; i < 4; i++) {
      const c = cams[i] || { name:'', src:null, eid:'' };
      const showImg = c.src ? 'block' : 'none';
      const showMsg = c.src ? 'none' : 'flex';
      const msg = c.eid ? '<span style="font-size:1.3rem">📷</span><span>Loading...</span>' : '<span style="font-size:1.3rem">📷</span><span>No camera</span>';
      g += `<div onclick="const o=this.closest('[data-host]')._cardHost;o._openCameraFull(${i})" style="aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);position:relative;cursor:${c.eid ? 'pointer' : 'default'}">
        <img src="${c.src || ''}" loading="lazy" style="width:100%;height:100%;object-fit:contain;display:${showImg};background:#000" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div style="display:${showMsg};align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.25);font-size:.7rem;flex-direction:column;gap:4px">${msg}</div>
      </div>`;
    }
    this._popup(this._popupClose() + this._popupTitle('📷 Cameras') +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${g}</div>`);
  }

  _openCameraFull(i) {
    const c = this._cams?.[i] || { name:'', src:null, eid:'' };
    const showImg = c.src ? 'block' : 'none';
    const showMsg = c.src ? 'none' : 'flex';
    const msg = c.eid ? '<span style="font-size:1.6rem">📷</span><span>Loading...</span>' : '<span style="font-size:1.6rem">📷</span><span>No camera</span>';
    this._popup(this._popupClose() + this._popupTitle('📷 ' + (c.name || '')) +
      `<div style="display:flex;flex-direction:column;gap:12px">
        <div onclick="const o=this.closest('[data-host]')._cardHost;o._openCameraPopup()" style="align-self:flex-start;font-size:.62rem;letter-spacing:1.5px;text-transform:uppercase;color:#f39c4b;cursor:pointer;display:flex;align-items:center;gap:5px;background:rgba(243,156,75,0.10);border:1px solid rgba(243,156,75,0.25);padding:5px 12px;border-radius:8px">&larr; Back to all cameras</div>
        <div style="aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);position:relative">
          <img src="${c.src || ''}" style="width:100%;height:100%;object-fit:contain;display:${showImg};background:#000" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:${showMsg};align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:.8rem;flex-direction:column;gap:6px">${msg}</div>
        </div>
      </div>`, { maxWidth: '920px' });
  }

  _openSystemPopup() {
    const v = (e) => { const r = this._val(e); return r !== null && !isNaN(r) ? r : null; };
    const cpu   = v(this.config.sys_cpu_entity);
    const mem   = v(this.config.sys_mem_entity);
    const disk  = v(this.config.sys_disk_entity);
    const upState = this._hass?.states?.[this.config.sys_uptime_entity]?.state;
    const uptime = upState && upState !== 'unavailable' && upState !== 'unknown' ? this._fmtUptime(upState) : '--';
    const c1    = v(this.config.sys_core1_temp);
    const c2    = v(this.config.sys_core2_temp);
    const pkg   = v(this.config.sys_package_temp);
    const erx   = v(this.config.sys_eth0_rx);
    const etx   = v(this.config.sys_eth0_tx);
    const wrx   = v(this.config.sys_wlan0_rx);
    const wtx   = v(this.config.sys_wlan0_tx);
    const fmtV  = (val, unit) => val !== null ? val + (unit || '') : '--';
    const fmtN  = (val) => this._fmtNetwork(val);
    this._popup(this._popupClose() + this._popupTitle('🖥️ System') + this._popupGrid([
      this._popupEntityItem('CPU Usage', fmtV(cpu, '%'), this.config.sys_cpu_entity, '#58a6ff'),
      this._popupEntityItem('Memory', fmtV(mem, '%'), this.config.sys_mem_entity, '#3fb950'),
      this._popupEntityItem('Disk', fmtV(disk, '%'), this.config.sys_disk_entity, '#f39c4b'),
      this._popupEntityItem('Uptime', uptime, this.config.sys_uptime_entity, '#4ade80'),
      this._popupEntityItem('Core 1 Temp', fmtV(c1, '°C'), this.config.sys_core1_temp, '#e0e8f0'),
      this._popupEntityItem('Core 2 Temp', fmtV(c2, '°C'), this.config.sys_core2_temp, '#e0e8f0'),
      this._popupEntityItem('Package Temp', fmtV(pkg, '°C'), this.config.sys_package_temp, '#e0e8f0'),
      this._popupEntityItem('Eth0 RX', fmtN(erx), this.config.sys_eth0_rx, '#29b6f6'),
      this._popupEntityItem('Eth0 TX', fmtN(etx), this.config.sys_eth0_tx, '#29b6f6'),
      this._popupEntityItem('Wlan0 RX', fmtN(wrx), this.config.sys_wlan0_rx, '#ce93d8'),
      this._popupEntityItem('Wlan0 TX', fmtN(wtx), this.config.sys_wlan0_tx, '#ce93d8'),
    ]));
  }

  _openInverterPopup() {
    const v = (e) => { const r = this._val(e); return r !== null && !isNaN(r) ? r : null; };
    const s = (e) => { const r = this._strVal(e); return r || null; };
    const invT = v(this.config.inv_temp);
    const radT = v(this.config.inv_rad_temp);
    const totH = v(this.config.inv_total_hours);
    const err  = s(this.config.inv_error_entity);
    const mode = s(this.config.inv_mode_entity);
    const errorHtml = err && err !== '0' && err !== 'none' && err !== 'ok' && err !== 'normal'
      ? `<span style="color:#ef4444">${err}</span>`
      : `<span style="color:#4ade80">No Errors</span>`;
    // Error full-width row (spans 2 columns)
    const errClick = this.config.inv_error_entity ? `onclick="const h=this.closest('[data-host]')._cardHost;h.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:'${this.config.inv_error_entity}'},bubbles:true,composed:true}));window.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:'${this.config.inv_error_entity}'}}))"` : '';
    const errorRow = `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px 14px;text-align:center;margin-bottom:10px${this.config.inv_error_entity ? ';cursor:pointer' : ''}" ${errClick}>
      <div style="font-size:.6rem;color:rgba(200,215,235,0.5);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px">Error</div>
      <div style="font-size:1rem;font-weight:650">${errorHtml}</div></div>`;
    const invMaxPwr = this.config.inverter_max_power || 6000;
    const dodOn  = this.config.inv_dod_on_grid ? v(this.config.inv_dod_on_grid) : null;
    const dodOff = this.config.inv_dod_off_grid ? v(this.config.inv_dod_off_grid) : null;
    const exLim  = this.config.inv_export_limit ? v(this.config.inv_export_limit) : null;
    // Slider matching zee-home-card design: [icon] [label] [bar+thumb] [value] + service call
    const sl = (icon, label, val, unit, min, max, step, entityId) => {
      const vv = val !== null ? val : 0;
      const tt = val !== null ? val + ' ' + unit : '-- ' + unit;
      const pct = val !== null ? Math.max(0, Math.min(100, ((val - min) / (max - min || 1)) * 100)) : 0;
      const svc = entityId ? `host._hass.callService('number','set_value',{entity_id:'${entityId}',value:parseFloat(this.value)});` : '';
      // Range input is confined to the track bar only (not the whole row), so
      // clicking the icon/label/value area no longer changes the value — only
      // clicking inside the bar or dragging the thumb does. A ±9px vertical
      // overhang keeps the thin 4px bar easy to hit and drag.
      return `<div data-sl-row style="position:relative;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 14px;margin-bottom:8px">
        <span style="flex-shrink:0;font-size:.85rem;line-height:1">${icon}</span>
        <span style="flex-shrink:0;font-size:.72rem;color:rgba(200,215,235,0.7);max-width:38%">${label}</span>
        <div style="flex:1;display:flex;align-items:center;gap:6px">
          <div style="flex:1;position:relative;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;margin-left:15px">
            <div style="width:${pct}%;height:100%;background:#f39c4b;border-radius:2px;transition:width .1s" class="sl-fill"></div>
            <div style="position:absolute;top:50%;left:${pct}%;width:14px;height:14px;background:#fff;border:2px solid #f39c4b;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.3);transition:left .1s" class="sl-thumb"></div>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${vv}" style="position:absolute;left:0;right:0;top:-9px;height:22px;margin:0;opacity:0;cursor:pointer" oninput="
              const p=((this.value-${min})/(${max}-${min}||1))*100;
              const row=this.closest('[data-sl-row]');
              const host=this.closest('[data-host]')._cardHost;
              row.querySelector('.sl-fill').style.width=p+'%';
              row.querySelector('.sl-thumb').style.left=p+'%';
              row.querySelector('.sl-val').textContent=this.value+' ${unit}';
              ${svc}">
          </div>
          <span style="font-size:.78rem;font-weight:600;color:#e0e8f0;flex-shrink:0;min-width:44px;text-align:right" class="sl-val">${tt}</span>
        </div>
      </div>`;
    };
    const statsItems = [
      this._popupEntityItem('Inverter Temp', invT !== null ? invT + ' °C' : '--', this.config.inv_temp, '#e0e8f0'),
      this._popupEntityItem('Rad Temp', radT !== null ? radT + ' °C' : '--', this.config.inv_rad_temp, '#e0e8f0'),
      this._popupEntityItem('Total Hours', totH !== null ? totH.toFixed(1) + ' h' : '--', this.config.inv_total_hours, '#3fb950'),
      this._popupEntityItem('Mode', mode !== null ? mode.charAt(0).toUpperCase() + mode.slice(1) : '--', this.config.inv_mode_entity, '#58a6ff'),
    ];
    let controlsHtml = '';
    if (dodOn !== null || dodOff !== null || exLim !== null) {
      controlsHtml = `<div style="margin-top:14px">` +
        this._popupTitle('Controls') +
        (dodOn !== null ? sl('🪫', 'DoD On-grid', dodOn, '%', 0, 100, 1, this.config.inv_dod_on_grid) : '') +
        (dodOff !== null ? sl('🪫', 'DoD Off-grid', dodOff, '%', 0, 100, 1, this.config.inv_dod_off_grid) : '') +
        (exLim !== null ? sl('📤', 'Export Limit', exLim, 'W', 0, invMaxPwr, 100, this.config.inv_export_limit) : '') +
        `</div>`;
    }
    this._popup(this._popupClose() + this._popupTitle('⚡ Inverter') +
      errorRow +
      `<div style="margin-bottom:6px">${this._popupGrid(statsItems)}</div>${controlsHtml}`);
  }

  _openBatteryPopup() {
    const v = (e) => { const r = this._val(e); return r !== null && !isNaN(r) ? r : null; };
    const s = (e) => { const r = this._strVal(e); return r || null; };
    const status = s(this.config.bat_status);
    const soc   = v(this.config.battery_soc);
    const volt  = v(this.config.battery_voltage);
    const pwr   = v(this.config.battery_power);
    const cur   = v(this.config.battery_current) ?? v(this.config.goodwe_battery_curr);
    const cellMax = v(this.config.battery_max_cell);
    const cellMin = v(this.config.battery_min_cell);
    const soh   = v(this.config.bat_soh);
    const idx   = v(this.config.bat_index);
    const bmsVer = s(this.config.bat_bms_version);
    const cellMaxT = v(this.config.bat_cell_max_temp);
    const cellMinT = v(this.config.bat_cell_min_temp);
    const bmsT   = v(this.config.battery_mos);
    this._popup(this._popupClose() + this._popupTitle('🔋 Battery') +
      this._popupGrid([
      this._popupEntityItem('Battery Status', status !== null ? status.charAt(0).toUpperCase() + status.slice(1) : '--', this.config.bat_status, status !== null ? '#4ade80' : '#e0e8f0'),
      this._popupEntityItem('SOC', soc !== null ? soc + ' %' : '--', this.config.battery_soc, '#4ade80'),
      this._popupEntityItem('Voltage', volt !== null ? volt.toFixed(2) + ' V' : '--', this.config.battery_voltage, '#4ade80'),
      this._popupEntityItem('Power', pwr !== null ? pwr.toFixed(0) + ' W' : '--', this.config.battery_power, '#e0e8f0'),
      this._popupEntityItem('Current', cur !== null ? cur.toFixed(2) + ' A' : '--', this.config.battery_current || this.config.goodwe_battery_curr, '#e0e8f0'),
      this._popupEntityItem('Cell Max V', cellMax !== null ? cellMax.toFixed(3) + ' V' : '--', this.config.battery_max_cell, cellMax !== null && cellMax > 3.65 ? '#ef4444' : '#4ade80'),
      this._popupEntityItem('Cell Min V', cellMin !== null ? cellMin.toFixed(3) + ' V' : '--', this.config.battery_min_cell, cellMin !== null && cellMin < 3.0 ? '#ef4444' : '#4ade80'),
      this._popupEntityItem('SOH', soh !== null ? soh + ' %' : '--', this.config.bat_soh, '#3fb950'),
      this._popupEntityItem('Index', idx !== null ? idx : '--', this.config.bat_index, '#58a6ff'),
      this._popupItem('BMS Version', bmsVer !== null ? bmsVer : '--', '#ce93d8'),
      this._popupEntityItem('Cell Max Temp', cellMaxT !== null ? cellMaxT.toFixed(1) + ' °C' : '--', this.config.bat_cell_max_temp, cellMaxT !== null ? this._tempColor(cellMaxT) : '#e0e8f0'),
      this._popupEntityItem('Cell Min Temp', cellMinT !== null ? cellMinT.toFixed(1) + ' °C' : '--', this.config.bat_cell_min_temp, cellMinT !== null ? this._tempColor(cellMinT) : '#e0e8f0'),
      this._popupEntityItem('BMS Temp', bmsT !== null ? bmsT.toFixed(1) + ' °C' : '--', this.config.battery_mos, bmsT !== null ? this._tempColor(bmsT) : '#e0e8f0'),
    ]));
  }

  _openSmartPlugPopup() {
    const plugs = [];
    for (let i = 1; i <= 2; i++) {
      const eid = this.config[`smart_plug_${i}_entity`];
      const name = this.config[`smart_plug_${i}_name`] || `Plug ${i}`;
      const state = eid && this._hass?.states[eid] ? this._hass.states[eid] : null;
      const isOn = state && (state.state === 'on' || state.state === 'true');
      const power = this._val(this.config[`smart_plug_${i}_power`]);
      const volt = this._val(this.config[`smart_plug_${i}_voltage`]);
      const current = this._val(this.config[`smart_plug_${i}_current`]);
      plugs.push({
        name, eid, isOn, power, volt, current,
        powerEid: this.config[`smart_plug_${i}_power`],
        voltEid:  this.config[`smart_plug_${i}_voltage`],
        curEid:   this.config[`smart_plug_${i}_current`],
      });
    }
    const assigned = plugs.filter(p => p.eid);
    // One metric stat block (larger, labelled) inside a plug card
    const plugMetric = (icon, label, value, clr, eid) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:9px 6px;text-align:center${eid ? ';cursor:pointer' : ''}"${eid ? ` data-eid="${eid}"` : ''}>
      <div style="font-size:.54rem;letter-spacing:1px;text-transform:uppercase;color:rgba(200,215,235,0.5);margin-bottom:4px">${icon} ${label}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${clr};line-height:1.1">${value}</div>
    </div>`;
    const rows = assigned.map((p) => {
      const chk = p.isOn ? 'checked' : '';
      const pwrV = p.power !== null ? p.power.toFixed(0) + ' W' : '-- W';
      const vltV = p.volt !== null ? p.volt.toFixed(1) + ' V' : '-- V';
      const curV = p.current !== null ? p.current.toFixed(2) + ' A' : '-- A';
      return `<div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:1.1rem;line-height:1;flex-shrink:0">🔌</span>
            <span style="font-size:.95rem;font-weight:650;color:#e0e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
            <span style="font-size:.55rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;flex-shrink:0;background:${p.isOn ? 'rgba(243,156,75,0.18)' : 'rgba(255,255,255,0.06)'};color:${p.isOn ? '#f39c4b' : 'rgba(200,215,235,0.5)'}">${p.isOn ? 'On' : 'Off'}</span>
          </div>
          <label style="position:relative;display:inline-block;width:42px;height:24px;flex-shrink:0;cursor:pointer">
            <input type="checkbox" ${chk} style="opacity:0;width:0;height:0;position:absolute" onchange="
              const o=this.closest('[data-host]')._cardHost;
              if(o&&o._hass)o._hass.callService('switch','toggle',{entity_id:'${p.eid}'});
              this.parentElement.querySelector('.trk').style.background=this.checked?'#f39c4b':'rgba(255,255,255,0.15)';
              this.parentElement.querySelector('.knb').style.left=this.checked?'20px':'2px'">
            <span class="trk" style="position:absolute;inset:0;border-radius:12px;transition:background .2s;background:${p.isOn ? '#f39c4b' : 'rgba(255,255,255,0.15)'}"></span>
            <span class="knb" style="position:absolute;top:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:left .2s;left:${p.isOn ? '20px' : '2px'}"></span>
          </label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${plugMetric('⚡', 'Power', pwrV, '#f39c4b', p.powerEid)}
          ${plugMetric('🔌', 'Voltage', vltV, '#29b6f6', p.voltEid)}
          ${plugMetric('〰️', 'Current', curV, '#4ade80', p.curEid)}
        </div>
      </div>`;
    }).join('');
    this._popup(this._popupClose() + this._popupTitle('🔌 Smart Plugs') +
      (rows || '<div style="color:rgba(200,215,235,0.4);font-size:.8rem;text-align:center;padding:20px 0">No smart plugs configured</div>'));
  }

  _openClimatePopup() {
    const eid = this.config.climate_entity;
    const name = this.config.clim_ac_name || 'AC';
    const st = eid && this._hass?.states[eid] ? this._hass.states[eid] : null;
    const t = st ? parseFloat(st.attributes?.temperature || st.state) : null;
    const ct = st ? parseFloat(st.attributes?.current_temperature) : null;
    const hu = st ? parseFloat(st.attributes?.current_humidity) : null;
    const hv = st?.state || 'off';
    const fm = st?.attributes?.fan_mode || '';
    const sw = st?.attributes?.swing_mode || '';
    const on = hv === 'heat' || hv === 'cool' || hv === 'heat_cool' || hv === 'auto' || hv === 'fan_only' || hv === 'dry';
    const modes = ['off','cool','heat','auto','fan_only','dry'];
    const modeIcon = { off:'⏻', cool:'❄️', heat:'🔥', auto:'🔄', fan_only:'🌀', dry:'💧' };
    const _ml = (m) => String(m).replace(/_/g,' ').toUpperCase();
    const fans = st?.attributes?.fan_modes || [];
    const swings = st?.attributes?.swing_modes || [];
    const tv = t !== null && !isNaN(t) ? t : 24;
    const chip = (l, active, onclick) =>
      `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.65rem;font-weight:600;padding:4px 12px;border-radius:20px;cursor:pointer;transition:all .15s;user-select:none;border:1px solid rgba(255,255,255,0.12);background:${active ? '#03a9f4' : 'rgba(255,255,255,0.05)'};border-color:${active ? '#03a9f4' : 'rgba(255,255,255,0.12)'};color:${active ? '#fff' : '#c9d1d9'}" onclick="${onclick.replace(/"/g,'&quot;')}">${l}</span>`;
    const metric = (icon, label, value, clr, eid) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:9px 6px;text-align:center${eid ? ';cursor:pointer' : ''}"${eid ? ` data-eid="${eid}"` : ''}>
      <div style="font-size:.54rem;letter-spacing:1px;text-transform:uppercase;color:rgba(200,215,235,0.5);margin-bottom:4px">${icon} ${label}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${clr};line-height:1.1">${value}</div>
    </div>`;
    this._popup(this._popupClose() + this._popupTitle('🌡️ Climate') +
      `<div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:1.1rem;line-height:1;flex-shrink:0">🌡️</span>
            <span style="font-size:.95rem;font-weight:650;color:#e0e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
            <span style="font-size:.55rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;flex-shrink:0;background:${on ? 'rgba(243,156,75,0.18)' : 'rgba(255,255,255,0.06)'};color:${on ? '#f39c4b' : 'rgba(200,215,235,0.5)'}">${on ? (hv.toUpperCase()) : 'OFF'}</span>
          </div>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:.65rem;font-weight:600;padding:4px 12px;border-radius:20px;cursor:pointer;transition:all .15s;user-select:none;border:1px solid rgba(255,255,255,0.12);background:${on ? '#03a9f4' : 'rgba(255,255,255,0.05)'};border-color:${on ? '#03a9f4' : 'rgba(255,255,255,0.12)'};color:${on ? '#fff' : '#c9d1d9'}" onclick="const o=this.closest('[data-host]')._cardHost;if(o&&o._hass)o._hass.callService('climate','toggle',{entity_id:'${eid}'});this.style.background=this.style.background==='rgb(3, 169, 244)'?'rgba(255,255,255,0.05)':'#03a9f4';this.style.color=this.style.color==='rgb(255, 255, 255)'?'#c9d1d9':'#fff';this.style.borderColor=this.style.borderColor==='rgb(3, 169, 244)'?'rgba(255,255,255,0.12)':'#03a9f4';this.textContent=this.textContent==='✓ ON'?'OFF':'✓ ON'">${on ? '✓ ON' : 'OFF'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${metric('🌡️', 'Current', ct !== null && !isNaN(ct) ? ct.toFixed(1) + ' °C' : '-- °C', '#29b6f6', eid)}
          ${metric('🎚️', 'Set', tv.toFixed(1) + ' °C', '#f39c4b', eid)}
          ${metric('💧', 'Humidity', hu !== null && !isNaN(hu) ? hu.toFixed(0) + ' %' : '-- %', hu !== null && !isNaN(hu) ? '#4ade80' : '#8b949e', eid)}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:12px">
          <button style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="
            const o=this.parentElement.closest('[data-host]')._cardHost;
            if(o&&o._hass)o._hass.callService('climate','set_temperature',{entity_id:'${eid}',temperature:${(tv-1).toFixed(1)}});
            this.nextElementSibling.textContent=(${(tv-1).toFixed(1)})+'°C'">&minus;</button>
          <span style="min-width:44px;text-align:center;font-size:1rem;font-weight:650;color:#e0e8f0">${tv.toFixed(1)}°C</span>
          <button style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="
            const o=this.parentElement.closest('[data-host]')._cardHost;
            if(o&&o._hass)o._hass.callService('climate','set_temperature',{entity_id:'${eid}',temperature:${(tv+1).toFixed(1)}});
            this.previousElementSibling.textContent=(${(tv+1).toFixed(1)})+'°C'">+</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">${
        modes.map(m => {
          const _a = hv === m;
          return `<div data-chip style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:7px 4px;border-radius:10px;cursor:pointer;user-select:none;transition:all .15s;border:1px solid ${_a ? '#03a9f4' : 'rgba(255,255,255,0.12)'};background:${_a ? '#03a9f4' : 'rgba(255,255,255,0.05)'};color:${_a ? '#fff' : '#c9d1d9'}" onclick="const o=this.closest('[data-host]')._cardHost;if(o&&o._hass)o._hass.callService('climate','set_hvac_mode',{entity_id:'${eid}',hvac_mode:'${m}'});this.parentElement.querySelectorAll('[data-chip]').forEach(c=>{c.style.background='rgba(255,255,255,0.05)';c.style.color='#c9d1d9';c.style.borderColor='rgba(255,255,255,0.12)'});this.style.background='#03a9f4';this.style.color='#fff';this.style.borderColor='#03a9f4'"><span style="font-size:1rem;line-height:1">${modeIcon[m] || '⚙️'}</span><span style="font-size:.58rem;font-weight:700;letter-spacing:.5px">${_ml(m)}</span></div>`;
        }).join('')
      }</div>${
        fans.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px"><span style="font-size:.6rem;color:rgba(200,215,235,0.4);letter-spacing:1px;text-transform:uppercase;width:100%;text-align:center;margin-bottom:2px">Fan</span>${
          fans.map(f => chip(_ml(f), fm === f,
            `const o=this.closest('[data-host]')._cardHost;if(o&&o._hass)o._hass.callService('climate','set_fan_mode',{entity_id:'${eid}',fan_mode:'${f}'});this.parentElement.querySelectorAll('[data-chip]').forEach(c=>c.style.background='rgba(255,255,255,0.05)');this.style.background='#03a9f4';this.style.color='#fff';this.style.borderColor='#03a9f4'`)).join('')
        }</div>` : ''
      }${
        swings.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px"><span style="font-size:.6rem;color:rgba(200,215,235,0.4);letter-spacing:1px;text-transform:uppercase;width:100%;text-align:center;margin-bottom:2px">Swing</span>${
          swings.map(s => chip(_ml(s), sw === s,
            `const o=this.closest('[data-host]')._cardHost;if(o&&o._hass)o._hass.callService('climate','set_swing_mode',{entity_id:'${eid}',swing_mode:'${s}'});this.parentElement.querySelectorAll('[data-chip]').forEach(c=>c.style.background='rgba(255,255,255,0.05)');this.style.background='#03a9f4';this.style.color='#fff';this.style.borderColor='#03a9f4'`)).join('')
        }</div>` : ''
      }`);
  }

  _openRoomsPopup() {
    const rooms = [];
    for (let i = 1; i <= 2; i++) {
      rooms.push({
        name:   this.config[`room_${i}_name`] || `Room ${i}`,
        temp:   this._val(this.config[`room_${i}_temp`]),
        hum:    this._val(this.config[`room_${i}_humidity`]),
        batt:   this._val(this.config[`room_${i}_battery`]),
        hasTemp: !!this.config[`room_${i}_temp`],
        tempEid: this.config[`room_${i}_temp`],
        humEid:  this.config[`room_${i}_humidity`],
        battEid: this.config[`room_${i}_battery`],
      });
    }
    const roomMetric = (icon, label, value, clr, eid) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:9px 6px;text-align:center${eid ? ';cursor:pointer' : ''}"${eid ? ` data-eid="${eid}"` : ''}>
      <div style="font-size:.54rem;letter-spacing:1px;text-transform:uppercase;color:rgba(200,215,235,0.5);margin-bottom:4px">${icon} ${label}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${clr};line-height:1.1">${value}</div>
    </div>`;
    const rows = rooms.map((r) => {
      const tempV = r.temp !== null ? r.temp.toFixed(1) + ' °C' : '-- °C';
      const humV  = r.hum  !== null ? r.hum.toFixed(0) + ' %'  : '-- %';
      const battV = r.batt !== null ? r.batt.toFixed(0) + ' %'  : '-- %';
      const battClr = r.batt !== null ? (r.batt <= 20 ? '#ef4444' : r.batt <= 40 ? '#f59e0b' : '#4ade80') : '#8b949e';
      return `<div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:1.1rem;line-height:1;flex-shrink:0">🌡️</span>
            <span style="font-size:.95rem;font-weight:650;color:#e0e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
            ${r.hasTemp ? '' : `<span style="font-size:.55rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);color:rgba(200,215,235,0.5)">No sensor</span>`}
          </div>
          <span style="font-size:.55rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.06);color:${battClr}${r.battEid ? ';cursor:pointer' : ''}"${r.battEid ? ` data-eid="${r.battEid}"` : ''}>🔋 ${battV}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${roomMetric('🌡️', 'Temp', tempV, r.temp !== null ? this._tempColor(r.temp) : '#8b949e', r.tempEid)}
          ${roomMetric('💧', 'Humidity', humV, r.hum !== null ? '#29b6f6' : '#8b949e', r.humEid)}
        </div>
      </div>`;
    }).join('');
    this._popup(this._popupClose() + this._popupTitle('🏠 Rooms') +
      (rows || '<div style="color:rgba(200,215,235,0.4);font-size:.8rem;text-align:center;padding:20px 0">No room sensors configured</div>'));
  }

  _openFridgePopup() {
    const name = this.config.fridge_name || 'FRIDGE';
    const v = (e) => { const r = this._val(e); return r !== null && !isNaN(r) ? r : null; };
    const s = (e) => { const r = this._strVal(e); return r || null; };
    const fc = v(this.config.fridge_current_temp);
    const fs = v(this.config.fridge_set_temp);
    const zc = v(this.config.freezer_current_temp);
    const zs = v(this.config.freezer_set_temp);
    const mode = s(this.config.fridge_mode);
    const metric = (icon, label, value, clr, eid) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:9px 6px;text-align:center${eid ? ';cursor:pointer' : ''}"${eid ? ` data-eid="${eid}"` : ''}>
      <div style="font-size:.54rem;letter-spacing:1px;text-transform:uppercase;color:rgba(200,215,235,0.5);margin-bottom:4px">${icon} ${label}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${clr};line-height:1.1">${value}</div>
    </div>`;
    const tempColor = (t) => t !== null ? (t <= -15 ? '#4ade80' : t <= 5 ? '#29b6f6' : '#f39c4b') : '#8b949e';
    const door = (eid) => {
      const st = s(eid);
      if (!st) return { txt: '--', open: false, known: false };
      const open = st === 'on' || st === 'open' || st === 'true' || st === 'yes';
      const closed = st === 'off' || st === 'closed' || st === 'false' || st === 'no';
      return { txt: open ? 'OPEN' : closed ? 'CLOSED' : '--', open, known: open || closed };
    };
    const doorChip = (label, eid) => {
      const d = door(eid);
      const clr = !d.known ? '#8b949e' : d.open ? '#ef4444' : '#4ade80';
      return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.62rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 12px;border-radius:20px;cursor:${eid ? 'pointer' : 'default'};user-select:none;border:1px solid ${d.open ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'};background:rgba(255,255,255,0.05);color:${clr}"${eid ? ` data-eid="${eid}"` : ''}>${label} ${d.txt}</span>`;
    };
    this._popup(this._popupClose() + this._popupTitle('🧊 Fridge') +
      `<div style="background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:1.1rem;line-height:1;flex-shrink:0">🧊</span>
            <span style="font-size:.95rem;font-weight:650;color:#e0e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
            ${mode ? `<span style="font-size:.55rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;flex-shrink:0;cursor:${this.config.fridge_mode ? 'pointer' : 'default'};background:rgba(88,166,255,0.12);color:#58a6ff"${this.config.fridge_mode ? ` data-eid="${this.config.fridge_mode}"` : ''}>${String(mode).replace(/_/g, ' ').toUpperCase()}</span>` : ''}
          </div>
          ${doorChip('🚪', this.config.fridge_door)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${metric('🧊', 'Fridge Temp', fc !== null ? fc.toFixed(1) + ' °C' : '-- °C', tempColor(fc), this.config.fridge_current_temp)}
          ${metric('🎚️', 'Fridge Set', fs !== null ? fs.toFixed(1) + ' °C' : '-- °C', fs !== null ? '#f39c4b' : '#8b949e', this.config.fridge_set_temp)}
          ${metric('🧊', 'Freezer Temp', zc !== null ? zc.toFixed(1) + ' °C' : '-- °C', tempColor(zc), this.config.freezer_current_temp)}
          ${metric('🎚️', 'Freezer Set', zs !== null ? zs.toFixed(1) + ' °C' : '-- °C', zs !== null ? '#f39c4b' : '#8b949e', this.config.freezer_set_temp)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px">
          ${doorChip('🧊 FREEZER DOOR', this.config.freezer_door)}
        </div>
      </div>`);
  }

  _buildStaticSVG() {
    this._monListenersAttached = false;
    const dual = !!(this.config._show_battery2);
    const showBatt1 = !!(this.config._show_battery !== false);
    const ev   = !!(this.config._show_ev);
    const showPvExtra = !!(this.config._show_pv_extra);
    const iconPath = '/local/community/zee-skycard';    // icons served from HACS community folder

    const pv3txt = showPvExtra ? `<text id="pv3FlowVal" x="450" y="421" text-anchor="middle" font-size="11" font-weight="650" fill="#ffe83c">-- W</text>` : '';
    const pv4txt = showPvExtra ? `<text id="pv4FlowVal" x="500" y="421" text-anchor="middle" font-size="11" font-weight="650" fill="#ffe83c">-- W</text>` : '';

    // EV banner — styled to match the PV sun bubble (sharp bottom-left, pill shape, 60% transparent)
    const evtxt = ev ? `<g id="evGroup">
      <!-- EV flow: from house right side down into EV -->
      <path id="flowHomeEV" d="M 345,322 V 378" fill="none" stroke="#00aaff" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="6 5" opacity="0">
        <animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite" calcMode="linear"/>
      </path>
      <!-- EV banner — matches PV bubble style: sharp bottom-left, rounded other corners, 60% transparent -->
      <g id="evBannerGroup" opacity="1">
        <path d="M 308,395 L 308,380 A 11,11 0 0,1 319,369 L 408,369 A 11,11 0 0,1 419,380 L 419,382 A 11,11 0 0,1 408,393 L 320,393 L 308,395 Z"
              fill="rgba(0,0,0,0.60)" stroke="rgba(0,170,255,0.50)" stroke-width="1.2"/>
        <!-- W label + value -->
        <text x="330" y="379" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.50)" letter-spacing="0.8">W</text>
        <text id="evPowerVal"   x="330" y="389" text-anchor="middle" font-size="9.5" font-weight="650" fill="#00aaff">-- W</text>
        <!-- A label + value -->
        <text x="358" y="379" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.50)" letter-spacing="0.8">A</text>
        <text id="evCurrentVal" x="358" y="389" text-anchor="middle" font-size="9.5" font-weight="600" fill="#88ccff">-- A</text>
        <!-- SOC label + value -->
        <text x="385" y="379" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.50)" letter-spacing="0.8">SOC</text>
        <text id="evSocVal"     x="385" y="389" text-anchor="middle" font-size="9.5" font-weight="650" fill="#4ade80">-- %</text>
        <!-- ETA label + value -->
        <text x="410" y="379" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.50)" letter-spacing="0.8">ETA</text>
        <text id="evEtaVal"     x="410" y="389" text-anchor="middle" font-size="9" font-weight="600" fill="#4ade80">--</text>
      </g>
    </g>` : '';

    const batteryTip = `<rect x="75" y="122" width="18" height="6" rx="3" fill="url(#battCapGrad)"/>`;

    // Battery SVG – large cylinder matching model image, cyan fill, bold % text
    const battIconSection = !showBatt1 ? '' : (
      `<g transform="translate(399, 140) scale(0.86, 0.95)">
        <g id="battIconWrap">
          <!-- Outer shell -->
          <rect x="49" y="128" width="70" height="148" rx="12" fill="url(#battShellGrad)"/>
          ${batteryTip}
          <!-- Bottom cap -->
          <rect x="51" y="269" width="66" height="7" rx="3.5" fill="url(#battCapGrad)"/>
          <!-- Top rim -->
          <rect x="51" y="130" width="66" height="6" rx="3" fill="url(#battCapGrad)"/>
          <!-- Glass overlay -->
          <rect x="49" y="128" width="70" height="148" rx="12" fill="url(#battGlassBody)" style="pointer-events:none"/>
          <!-- Inner dark well -->
          <rect x="53" y="138" width="62" height="131" rx="9" fill="#080c10"/>` +
      (dual ? `
            <rect id="battFillBar1" x="53" y="269" width="30" height="0" rx="0" fill="#00f0ff" clip-path="url(#battBodyClipLeft)"/>
            <rect id="battFillHL1"  x="53" y="269" width="30" height="0" rx="0" fill="url(#battFillHighlight)" clip-path="url(#battBodyClipLeft)" style="pointer-events:none"/>
            <rect id="battFillBar2" x="85" y="269" width="30" height="0" rx="0" fill="#00f0ff" clip-path="url(#battBodyClipRight)"/>
            <rect id="battFillHL2"  x="85" y="269" width="30" height="0" rx="0" fill="url(#battFillHighlight)" clip-path="url(#battBodyClipRight)" style="pointer-events:none"/>
            <g id="battBoltGroup1" opacity="0"><polygon points="72,176 64,195 70,195 66,215 78,193 72,193 80,176" fill="#1a4aff" stroke="rgba(100,150,255,.5)" stroke-width="0.8" filter="url(#battGlowBolt)"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.0s" repeatCount="indefinite"/></polygon></g>
            <g id="battBoltGroup2" opacity="0"><polygon points="104,176 96,195 102,195 98,215 110,193 104,193 112,176" fill="#1a4aff" stroke="rgba(100,150,255,.5)" stroke-width="0.8" filter="url(#battGlowBolt)"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.0s" repeatCount="indefinite"/></polygon></g>
            <text id="fcBattVal1" x="68"  y="210" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" stroke="rgba(0,0,0,0.65)" stroke-width="2" paint-order="stroke">--%</text>
            <text id="fcBattVal2" x="100" y="210" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" stroke="rgba(0,0,0,0.65)" stroke-width="2" paint-order="stroke">--%</text>
          ` : `
            <rect id="battFillBar" x="53" y="269" width="62" height="0" rx="0" fill="#00f0ff" clip-path="url(#battBodyClip)"/>
            <rect id="battFillHL"  x="53" y="269" width="62" height="0" rx="0" fill="url(#battFillHighlight)" clip-path="url(#battBodyClip)" style="pointer-events:none"/>
            <g id="battBoltGroup" opacity="0"><polygon points="86,176 74,199 82,199 77,226 95,197 85,197 98,176" fill="#1a9fff" stroke="rgba(100,200,255,.6)" stroke-width="0.8" filter="url(#battGlowBolt)"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.0s" repeatCount="indefinite"/></polygon></g>
            <!-- Big bold % text – matches model image -->
            <text id="fcBattVal" x="84" y="215" text-anchor="middle" font-size="19" font-weight="800" fill="#fff" stroke="rgba(0,0,0,0.65)" stroke-width="2" paint-order="stroke">--%</text>
          `) +
      `<!-- Battery voltage at the top of the battery SVG -->
        <text id="fcBattVoltTop" x="84" y="152" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" stroke="rgba(0,0,0,0.65)" stroke-width="2" paint-order="stroke">-- V</text>
      </g>
      </g>`
    );

    this.shadowRoot.innerHTML = `<style>
      :host{display:block} @keyframes svgPulseOrange{0%,100%{filter:drop-shadow(0 0 5px #f39c4b)}50%{filter:drop-shadow(0 0 8px #f5b06a)}}
      @keyframes kfcTwinkle{0%,100%{opacity:.10}50%{opacity:.85}}
      @keyframes kfcRain{0%{transform:translateY(-30px) skewX(-10deg)}100%{transform:translateY(110%) skewX(-10deg)}}
      @keyframes kfcSnow{0%{transform:translateY(-10px) translateX(0)}25%{transform:translateY(28%) translateX(8px)}50%{transform:translateY(56%) translateX(-5px)}75%{transform:translateY(82%) translateX(9px)}100%{transform:translateY(110%) translateX(3px)}}
      @keyframes kfcLightning{0%,85%,88%,92%,100%{opacity:0}86%,90%{opacity:.8}}
      @keyframes kfcFogDrift{0%{transform:translateX(-6%)}100%{transform:translateX(6%)}}
      @keyframes kfcSunPulse{0%,100%{opacity:.16;transform:translate(-50%,-50%) scale(1)}50%{opacity:.28;transform:translate(-50%,-50%) scale(1.07)}}
      .kfc-shell{position:relative;overflow:hidden;border-radius:14px;padding:10px 8px;
        box-shadow:0 4px 28px rgba(0,0,0,.65);width:100%;box-sizing:border-box;
        border:1px solid rgba(255,255,255,.06);background:rgb(21,47,85);transition:background 1.2s ease;
        font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
      #kfcSkyDiv{position:absolute;top:0;left:0;right:0;height:58%;border-radius:14px 14px 0 0;overflow:hidden;pointer-events:none;z-index:0}
      .kfc-content{position:relative;z-index:1;margin-bottom:0}
      .st{background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:9px 8px;text-align:left}
      .stm{padding-left:8px;padding-right:8px}
      .st .l{font-size:var(--kfc-label-size,.56rem);color:rgba(200,215,235,0.65);letter-spacing:1.3px;text-transform:uppercase;margin-bottom:3px;font-weight:500;display:block;text-align:left}
      .st .v{font-size:var(--kfc-value-size,.95rem);font-weight:650;color:#e0e8f0;display:block;text-align:left}
      .dv{height:1px;background:rgba(255,255,255,.07);margin:10px 0}
      .ct{font-size:.65rem;font-weight:650;letter-spacing:2.5px;text-transform:uppercase;color:#f39c4b;display:flex;align-items:center;gap:8px}
      .ct::after{content:'';flex:1;height:1px;background:rgba(243,156,75,0.22)}
      .pvf{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:2px}
      .pvi{text-align:center;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
      .pvi .ico{font-size:1.7rem;margin-bottom:2px;display:block;text-align:center}
      .pvi .lbl{font-size:var(--kfc-label-size,.58rem);color:rgba(200,215,235,0.65);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px;display:block;text-align:center}
      .pvi .val{font-size:var(--kfc-value-size,1.1rem);font-weight:650;color:#e0e8f0;display:block;text-align:center}
      .pvi .val.yw{color:#f4d03f} text{font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
      .kfc-bars-row{display:flex;align-items:center;gap:8px;margin-top:0;padding:0 1px}
      .kfc-bar-col{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:4px}
      .kfc-bar-lbl{font-size:.7rem;color:rgba(200,215,235,0.60);letter-spacing:1.5px;font-weight:600;white-space:nowrap;flex-shrink:0}
      .kfc-bar-meter-wrap{flex:1 1 0;min-width:0;display:flex;align-items:center}
      .kfc-bar-pwr-slot{flex:1 1 0;min-width:0;position:relative;display:flex;align-items:center}
      .kfc-bar-pwr-slot .kfc-bar-meter-wrap{flex:1 1 0;width:100%;min-width:0}
      .kfc-bar-meter{width:90%;height:16px;flex:0 0 auto;display:flex;gap:2px;align-items:stretch;box-sizing:border-box}
      .kfc-bar-meter-pwr{position:relative;gap:0;height:16px;background:rgba(5,10,25,0.97);border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
      .kfc-pv-seg{flex:1 1 0;min-width:0;height:100%;border-radius:2px}
      .kfc-pwr-fill-area{position:absolute;left:0;top:0;bottom:0;right:0;overflow:hidden;border-radius:2px}
      #pwrBar{position:absolute;top:0;left:0;bottom:0;width:0%;height:100%;border-radius:2px;transition:width .4s ease,background .4s ease}
      .kfc-bar-pct{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:.58rem;font-weight:650;color:#29b6f6;line-height:1;white-space:nowrap;z-index:2;pointer-events:none}
    </style>
    <div class="kfc-shell" id="kfcShell">
      <div id="kfcSkyDiv" aria-hidden="true"></div>
      <div id="kfcBottomGrad" style="position:absolute;top:58%;left:0;right:0;bottom:0;pointer-events:none;z-index:0;border-radius:0 0 14px 14px;transition:background 1.4s ease"></div>
      <div class="kfc-content" style="transform:translateY(-3%)">
      <div class="ct" style="position:absolute;top:25px">&#x2014; Energy Flow <span id="battStatusBadge" style="margin-left:auto;font-size:.62rem;font-weight:650;letter-spacing:1.5px;padding:2px 10px;border-radius:8px;background:rgba(0,0,0,.32);color:#a8b4c8;text-transform:uppercase;border:1px solid rgba(255,255,255,.09)">IDLE</span></div>
      <div style="width:100%"><svg id="flowSvg" viewBox="0 0 520 465" style="width:100%;display:block">
      <defs>
        <filter id="arcSunF" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="arcSunF2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>
        <filter id="moonF"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="dynAuraG" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="rgba(30,100,200,.28)"/><stop offset="55%" stop-color="rgba(30,80,160,.10)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        <radialGradient id="sunCG" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="rgba(255,255,220,.98)"/><stop offset="40%" stop-color="rgb(255,125,10)"/><stop offset="100%" stop-color="rgba(255,130,10,.6)"/></radialGradient>
        <linearGradient id="arcDayGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgba(255,180,50,0)"/><stop offset="20%" stop-color="rgba(255,200,70,.5)"/><stop offset="50%" stop-color="rgba(255,228,110,.92)"/><stop offset="80%" stop-color="rgba(255,200,70,.5)"/><stop offset="100%" stop-color="rgba(255,180,50,0)"/></linearGradient>
        <linearGradient id="arcNightGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgba(140,170,255,0)"/><stop offset="30%" stop-color="rgba(155,185,255,.35)"/><stop offset="50%" stop-color="rgba(200,215,255,.7)"/><stop offset="70%" stop-color="rgba(155,185,255,.35)"/><stop offset="100%" stop-color="rgba(140,170,255,0)"/></linearGradient>
        <linearGradient id="battCapGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#2d2d2d"/><stop offset="18%" stop-color="#8f8f8f"/><stop offset="50%" stop-color="#ececec"/><stop offset="82%" stop-color="#7a7a7a"/><stop offset="100%" stop-color="#242424"/></linearGradient>
        <linearGradient id="battShellGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#050505"/><stop offset="18%" stop-color="#111"/><stop offset="50%" stop-color="#080808"/><stop offset="82%" stop-color="#111"/><stop offset="100%" stop-color="#030303"/></linearGradient>
        <linearGradient id="battGlassBody" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgba(255,255,255,0.03)"/><stop offset="15%" stop-color="rgba(255,255,255,0.22)"/><stop offset="33%" stop-color="rgba(255,255,255,0.05)"/><stop offset="50%" stop-color="rgba(255,255,255,0)"/><stop offset="67%" stop-color="rgba(255,255,255,0.05)"/><stop offset="85%" stop-color="rgba(255,255,255,0.18)"/><stop offset="100%" stop-color="rgba(255,255,255,0.03)"/></linearGradient>
        <linearGradient id="battFillHighlight" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="rgba(255,255,255,0.02)"/><stop offset="20%" stop-color="rgba(255,255,255,0.22)"/><stop offset="48%" stop-color="rgba(255,255,255,0.44)"/><stop offset="60%" stop-color="rgba(255,255,255,0.12)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></linearGradient>
        ${dual?`<clipPath id="battBodyClipLeft"><rect x="53" y="138" width="30" height="131" rx="6"/></clipPath><clipPath id="battBodyClipRight"><rect x="85" y="138" width="30" height="131" rx="6"/></clipPath>`:`<clipPath id="battBodyClip"><rect x="53" y="138" width="62" height="131" rx="9"/></clipPath>`}
        <filter id="battGlowRed"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="battGlowOrange"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="battGlowGreen"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="battGlowCyan"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="battGlowBolt"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>

        <filter id="iconGlowOrange" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b"/><feFlood flood-color="rgba(255,140,0,0.6)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="iconGlowBlue" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b"/><feFlood flood-color="rgba(30,144,255,0.6)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="iconGlowGreen" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b"/><feFlood flood-color="rgba(46,204,113,0.6)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="iconGlowYellow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" result="b"/><feFlood flood-color="rgba(255,230,0,0.7)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="flowGlowCyan" x="-70%" y="-220%" width="240%" height="540%"><feGaussianBlur stdDeviation="3.2" result="b"/><feFlood flood-color="rgba(62,205,255,0.78)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="flowGlowGreen" x="-70%" y="-220%" width="240%" height="540%"><feGaussianBlur stdDeviation="3.2" result="b"/><feFlood flood-color="rgba(145,255,55,0.78)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <!-- Sun glow: pure radial gradients, perfectly circular, zero square artefact -->
        <radialGradient id="sunGlowG1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,255,220,1)"/><stop offset="100%" stop-color="rgba(255,255,220,0)"/></radialGradient>
        <radialGradient id="sunGlowG2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,240,160,1)"/><stop offset="100%" stop-color="rgba(255,240,160,0)"/></radialGradient>
        <radialGradient id="sunGlowG3" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,210,80,1)"/><stop offset="100%" stop-color="rgba(255,210,80,0)"/></radialGradient>
        <radialGradient id="sunGlowG4" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,170,30,1)"/><stop offset="100%" stop-color="rgba(255,170,30,0)"/></radialGradient>
        <radialGradient id="sunCoreGD" cx="50%" cy="38%" r="60%">
          <stop offset="0%"   stop-color="#ffffff"/>
          <stop offset="45%"  stop-color="#fffbe8"/>
          <stop offset="100%" stop-color="#ffe090"/>
        </radialGradient>
        <filter id="flowGlowRed" x="-70%" y="-220%" width="240%" height="540%"><feGaussianBlur stdDeviation="3.2" result="b"/><feFlood flood-color="rgba(255,55,55,0.72)" result="c"/><feComposite in="c" in2="b" operator="in" result="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <marker id="arrowRed"    markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0.5 L0,4.5 L4.5,2.5 z" fill="#ff3434"/></marker>
        <marker id="arrowCyan"   markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0.5 L0,4.5 L4.5,2.5 z" fill="#00f0ff"/></marker>
        <marker id="arrowOrange" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0.5 L0,4.5 L4.5,2.5 z" fill="#e07800"/></marker>
        <marker id="arrowGreen"  markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0.5 L0,4.5 L4.5,2.5 z" fill="#39ff14"/></marker>
        <marker id="arrowGray"   markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0.5 L0,4.5 L4.5,2.5 z" fill="#9ca3af"/></marker>
      </defs>
      <ellipse id="skyAura" cx="260" cy="84" rx="230" ry="110" fill="url(#dynAuraG)" opacity="0.35"/>
    
      <!-- ── SUN/MOON ARC ── -->
      
      <ellipse id="skyAura2" cx="260" cy="159" rx="230" ry="110" fill="url(#dynAuraG)" opacity="0"/>
      <!-- Dashed horizon line -->
      <line x1="55" y1="161" x2="477" y2="161" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="4,9"/>
      <!-- Horizon dots: amber rise · white noon · orange-red set -->
      <circle cx="50"  cy="161" r="5"   fill="#f5c842"/>
      <circle cx="260" cy="161" r="3.5" fill="rgba(255,255,255,.30)"/>
      <circle cx="472" cy="161" r="5"   fill="#e05030"/>
    
      <!-- Time labels -->
    
      <text id="sunRiseLabel" x="50"  y="179" fill="rgba(255,255,255,.72)" font-size="11" font-weight="600" text-anchor="middle">--:--</text>
      <text x="260" y="179" fill="rgba(255,255,255,.32)" font-size="11" font-weight="400" text-anchor="middle">12:00</text>
      <text id="sunSetLabel"  x="472" y="179" fill="rgba(255,255,255,.72)" font-size="11" font-weight="600" text-anchor="middle">--:--</text>
    
      <!-- Golden day-arc (thicker, matches model image) -->
    
      <path id="sunArcTrack" d="M 42,161 Q 260,54 472,161" fill="none" stroke="url(#arcDayGrad)" stroke-width="2.0" stroke-linecap="round"/>
    
      <!-- Night dashed arc -->
    
      <path d="M 472,161 Q 260,54 42,161" fill="none" stroke="url(#arcNightGrad)" stroke-width="1.5" stroke-dasharray="4,6" opacity=".35"/>
      <g id="arcSunGroup" opacity="1">
        <!-- L4 outermost atmospheric haze pulsing -->
        <circle id="sunL4" cx="260" cy="12" r="110" fill="url(#sunGlowG4)" opacity="0.10">
          <animate attributeName="r"       values="110;138;110"    dur="3.8s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.08;0.18;0.08" dur="3.8s" repeatCount="indefinite"/>
        </circle>
        <!-- L3 outer corona -->
        <circle id="sunL3" cx="260" cy="12" r="70"  fill="url(#sunGlowG3)" opacity="0.18"/>
        <!-- L2 mid bloom -->
        <circle id="sunL2" cx="260" cy="12" r="42"  fill="url(#sunGlowG2)" opacity="0.32"/>
        <!-- L1 bright inner halo -->
        <circle id="sunL1" cx="260" cy="12" r="24"  fill="url(#sunGlowG1)" opacity="0.70"/>
        <!-- Brilliant white core -->
        <circle id="sunCore" cx="260" cy="12" r="14" fill="url(#sunCoreGD)"/>
      </g>
      <g id="moonGroup" opacity="0"></g>
      <!-- Moon rendered directly in SVG space on the arc -->
      <g id="moonSvgGroup" opacity="0" transform="translate(260,161)">
        <g id="moonSvgInner" transform="scale(0.85)"></g>
      </g>
      <!-- PV animated flow wave (sun → house) -->
      <g id="pvFlowGroupA" opacity="1"></g>
      <g id="pvFlowGroupB" opacity="0"></g>
      <!-- PV power bubble: sharp bottom-left, rounded top-left/top-right/bottom-right (r=13) -->
      <g id="pvBubbleGroup" opacity="0">
        <path id="pvBubbleBg"
              d="M 0,28 L 0,13 A 13,13 0 0,1 13,0 L 91,0 A 13,13 0 0,1 104,13 L 104,15 A 13,13 0 0,1 91,28 Z"
              fill="rgba(10,10,10,0.20)" stroke="#ffe040" stroke-width="1.5"/>
        <text id="pvBubbleVal" x="52" y="19" text-anchor="middle"
              font-size="12" font-weight="650" fill="#ffe040">-- kW ⚡</text>
      </g>
      <!-- ── ANIMATED FLOW LINES ── L-shaped, cyan=grid, green=battery ── -->
      <!-- ↓ lowerSection: translate Y only — arc above is untouched -->
      <g id="lowerSection" transform="translate(0,0)">

      <!-- GRID IN (importing, cyan): grid → house -->
      <path id="flowGridIn"  d="M 81,327 H 167 V 339 H 195" fill="none" stroke="rgba(0,240,255,0.28)" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite" calcMode="linear"/></path>
      <path id="flowGridInC" d="M 81,327 H 167 V 339 H 195" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none" marker-end="url(#arrowCyan)"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite" calcMode="linear"/></path>

      <!-- Grid flow labels — power above the line, voltage below (mirrors the battery flow) -->
      <text id="fcGridFlowVal" x="124" y="322" text-anchor="middle" font-size="11" font-weight="650" fill="#e0e8f0">0 W</text>
      <text id="fcGridFlowVolt" x="124" y="338" text-anchor="middle" font-size="11" font-weight="400" fill="rgba(180,200,230,0.45)">-- V</text>

      <!-- GRID OUT (exporting, cyan): house → grid -->
      <path id="flowGridOut"  d="M 195,339 H 167 V 327 H 81" fill="none" stroke="rgba(0,240,255,0.28)" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite" calcMode="linear"/></path>
      <path id="flowGridOutC" d="M 195,339 H 167 V 327 H 81" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none" marker-end="url(#arrowCyan)"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="0.8s" repeatCount="indefinite" calcMode="linear"/></path>

      <!-- Grid flow watt label moved — power shown above flowGridIn, voltage below -->

      ${showBatt1 ? `
      <!-- BATT IN (charging, green): house → battery -->
      <path id="flowBattIn"  d="M 335,339 H 360 V 327 H 462" fill="none" stroke="rgba(57,255,20,0.28)" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="4.0s" repeatCount="indefinite" calcMode="linear"/></path>
      <path id="flowBattInC" d="M 335,339 H 360 V 327 H 462" fill="none" stroke="#39ff14" stroke-width="1.5" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none" marker-end="url(#arrowGreen)"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="4.0s" repeatCount="indefinite" calcMode="linear"/></path>

      <!-- BATT OUT (discharging, green): battery → house -->
      <path id="flowBattOut"  d="M 462,327 H 360 V 339 H 335" fill="none" stroke="rgba(57,255,20,0.28)" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="4.0s" repeatCount="indefinite" calcMode="linear"/></path>
      <path id="flowBattOutC" d="M 462,327 H 360 V 339 H 335" fill="none" stroke="#39ff14" stroke-width="1.5" stroke-dasharray="6 5" stroke-linecap="round" opacity="0" style="display:none" marker-end="url(#arrowGreen)"><animate attributeName="stroke-dashoffset" from="11" to="0" dur="4.0s" repeatCount="indefinite" calcMode="linear"/></path>

      <!-- Batt watt label mid-line -->
      <text id="fcBattFlowVal" x="400" y="322" text-anchor="middle" font-size="11.5" font-weight="650" fill="#39ff14">0 W</text>
      ` : ''}

      <!-- ── BATTERY SVG CYLINDER ── -->
      ${battIconSection}


      <!-- ── TINY INV BADGE − temp + load% ── -->
      <g id="fcInvBannerGroup" display="${this.config._show_inv_banner === false ? 'none' : ''}">
      <rect id="fcInvRect" x="156" y="222" width="88" height="34" rx="10" fill="rgba(8,14,28,0.60)" stroke="rgba(244,169,59,0.65)" stroke-width="1.2"/>
      <text id="invNameLabel" x="204" y="235" text-anchor="middle" font-size="8" font-weight="650" fill="#f4a93b" letter-spacing="1.5">INV</text>
      <text id="invTempFlow" x="180" y="250" text-anchor="middle" font-size="9.5" font-weight="600" fill="#e0e8f0">-- °C</text>
      <text id="invLoadPctFlow" x="228" y="250" text-anchor="middle" font-size="9.5" font-weight="600" fill="#e0e8f0">--%</text>
      </g>



      <!-- Battery current below flow line -->
      <text id="fcBattCurrBelow" x="400" y="338" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">-- A</text>

      <!-- GRID / LOAD / PV cols + vertical dividers + horizontal rule — all pulled down together -->
      <g transform="translate(0,28)">

      <!-- Vertical dividers -->
      <line x1="182" y1="405" x2="182" y2="430" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>
      <line x1="327" y1="405" x2="327" y2="430" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>

      <!-- GRID col — single power+volt by default; L1/L2/L3 sub-values when 3-phase enabled -->
      <text x="75" y="400" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.75)" letter-spacing="1.5" font-weight="570">GRID</text>
      <!-- Default: power (left) + voltage (right) side-by-side on one baseline -->
      <text id="fcGridVal" x="45" y="421" text-anchor="middle" font-size="15" font-weight="650" fill="#e0e8f0">0 W</text>
      <text id="fcGridVoltVal" x="112" y="421" text-anchor="middle" font-size="11" font-weight="400" fill="rgba(180,200,230,0.45)">-- V</text>
      <text id="fcGridFreqVal" x="150" y="421" text-anchor="middle" font-size="11" font-weight="400" fill="rgba(180,200,230,0.45)">-- Hz</text>
      <!-- 3-phase sub-row: L1 | L2 | L3 — hidden by default, shown when _show_3phase enabled -->
      <g id="grid3PhaseVertical" display="none">
        <!-- L1 -->
        <text x="28"  y="409" font-size="6.5" fill="rgba(255,255,255,0.40)" letter-spacing="0.3" text-anchor="middle">L1</text>
        <text id="fcGridL1Val"     x="28"  y="420" font-size="10" font-weight="650" fill="#e0e8f0" text-anchor="middle">-- W</text>
        <text id="fcGridL1VoltVal" x="28"  y="430" font-size="8" font-weight="400" fill="rgba(180,200,230,0.45)" text-anchor="middle">-- V</text>
        <!-- L2 -->
        <text x="75"  y="409" font-size="6.5" fill="rgba(255,255,255,0.40)" letter-spacing="0.3" text-anchor="middle">L2</text>
        <text id="fcGridL2Val"     x="75"  y="420" font-size="10" font-weight="650" fill="#e0e8f0" text-anchor="middle">-- W</text>
        <text id="fcGridL2VoltVal" x="75"  y="430" font-size="8" font-weight="400" fill="rgba(180,200,230,0.45)" text-anchor="middle">-- V</text>
        <!-- L3 -->
        <text x="122" y="409" font-size="6.5" fill="rgba(255,255,255,0.40)" letter-spacing="0.3" text-anchor="middle">L3</text>
        <text id="fcGridL3Val"     x="122" y="420" font-size="10" font-weight="650" fill="#e0e8f0" text-anchor="middle">-- W</text>
        <text id="fcGridL3VoltVal" x="122" y="430" font-size="8" font-weight="400" fill="rgba(180,200,230,0.45)" text-anchor="middle">-- V</text>
      </g>

      <!-- LOAD col — power (left) + voltage (right) side-by-side -->
      <text x="254" y="400" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.75)" letter-spacing="1.5" font-weight="570">LOAD</text>
      <text id="fcLoadVal" x="222" y="421" text-anchor="middle" font-size="15" font-weight="650" fill="#e0e8f0">-- W</text>
      <text id="fcLoadVoltVal" x="290" y="421" text-anchor="middle" font-size="11" font-weight="400" fill="rgba(180,200,230,0.45)">-- V</text>

      <!-- PV col -->
      <text x="420" y="400" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.75)" letter-spacing="2.5" font-weight="570">PV</text>
      <text id="fcPvGenBelowVal" x="-999" y="-999" font-size="1" fill="none">-- kW</text>
      <text id="fcPv1SubVal" x="${showPvExtra ? '350' : '370'}" y="421" text-anchor="middle" font-size="13" font-weight="650" fill="#e0e8f0">-- W</text>
      <text id="fcPv2SubVal" x="${showPvExtra ? '400' : '470'}" y="421" text-anchor="middle" font-size="13" font-weight="650" fill="#e0e8f0">-- W</text>
      ${pv3txt}${pv4txt}

      <!-- Horizontal rule — floor of table row -->
      <line x1="10" y1="436" x2="510" y2="436" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>

      </g>
      ${evtxt}
      </g><!-- /lowerSection -->
      </svg></div>`+

      `<div class="kfc-bars-row" style="margin-top:10px">
        <div class="kfc-bar-col">
          <span class="kfc-bar-lbl">&#x2014; PV</span>
          <div class="kfc-bar-meter-wrap"><div id="pvBlocks" class="kfc-bar-meter"><div id="pvSeg0" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg1" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg2" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg3" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg4" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg5" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg6" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg7" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg8" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg9" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg10" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg11" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg12" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg13" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg14" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg15" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div><div id="pvSeg16" class="kfc-pv-seg" style="background:rgba(255,255,255,0.07)"></div></div></div>
        </div>
        <div class="kfc-bar-col">
          <span class="kfc-bar-lbl">PWR</span>
          <div class="kfc-bar-pwr-slot">
            <div class="kfc-bar-meter-wrap">
              <div class="kfc-bar-meter kfc-bar-meter-pwr">
                <div class="kfc-pwr-fill-area"><div id="pwrBar"></div></div>
              </div>
            </div>
            <span id="pwrPct" class="kfc-bar-pct">0%</span>
          </div>
        </div>
      </div>

      <!-- Row 1: CELL TEMP | BMS TEMP | PV VOLTAGE -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px">
        <div class="st">
          <div style="min-width:0;width:100%">
            <div class="l">${this.config.label_cell_temp_minmax||'CELL TEMP'}</div>
            ${(this.config._labels_custom_entities && this.config.label_entity_cell_temp) ? `
            <div class="v" id="bTemp1" style="color:#e0e8f0;margin-top:4px;font-size:.75rem">--</div>
            <span id="bTemp1b" style="display:none"></span>` : `
            <div style="display:flex;justify-content:space-evenly;align-items:center;width:100%;margin-top:2px">
              <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                <span style="font-size:.55rem;color:rgba(200,215,235,0.50);letter-spacing:1px;text-transform:uppercase">T1</span>
                <span id="bTemp1" style="font-size:.75rem;font-weight:650;color:#e0e8f0">--</span>
              </div>
              <div style="width:1px;height:24px;background:rgba(255,255,255,0.12)"></div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                <span style="font-size:.55rem;color:rgba(200,215,235,0.50);letter-spacing:1px;text-transform:uppercase">T2</span>
                <span id="bTemp1b" style="font-size:.75rem;font-weight:650;color:#e0e8f0">-- °C</span>
              </div>
            </div>`}
          </div>
        </div>
        <div class="st stm">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:1.0rem;line-height:1;flex-shrink:0">&#x1F321;&#xFE0F;</span>
            <div style="min-width:0">
              <div class="l">${this.config.label_bms_temp||'BMS TEMP'}</div>
              <div class="v" id="bTemp2" style="color:#e0e8f0;font-size:.75rem">-- &#x00B0;C</div>
            </div>
          </div>
        </div>
        <div class="st">
          <div style="min-width:0;width:100%">
            <div class="l" style="margin-bottom:4px">${this.config.label_pv_voltage||'PV VOLTAGE'}</div>
            <div style="display:flex;justify-content:space-evenly;align-items:center;width:100%">
              <span id="bPv1Volt" style="font-size:.75rem;font-weight:650;color:#ffe83c">-- V</span>
              <span id="bPv2Volt" style="font-size:.75rem;font-weight:650;color:#ffe83c">-- V</span>
              ${showPvExtra ? `<span id="bPv3Volt" style="font-size:.75rem;font-weight:650;color:#ffe83c">-- V</span>` : ''}
              ${showPvExtra ? `<span id="bPv4Volt" style="font-size:.75rem;font-weight:650;color:#ffe83c">-- V</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: CELL VOLT | REMAINING | TODAY Battery CHG / DIS -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        <div class="st">
          <div style="min-width:0;width:100%">
            <div class="l">${this.config.label_cell_volt||'CELL VOLT'}</div>
            ${(this.config._labels_custom_entities && this.config.label_entity_cell_volt) ? `
            <div class="v" id="bMinCell" style="color:#e0e8f0;margin-top:4px;font-size:.75rem">-- V</div>
            <span id="bMaxCell" style="display:none"></span>` : `
            <div style="display:flex;justify-content:space-evenly;align-items:center;width:100%;margin-top:2px">
              <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                <span style="font-size:.55rem;color:rgba(200,215,235,0.50);letter-spacing:1px;text-transform:uppercase">MIN</span>
                <span id="bMinCell" style="font-size:.75rem;font-weight:650;color:#e0e8f0">-- V</span>
              </div>
              <div style="width:1px;height:24px;background:rgba(255,255,255,0.12)"></div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                <span style="font-size:.55rem;color:rgba(200,215,235,0.50);letter-spacing:1px;text-transform:uppercase">MAX</span>
                <span id="bMaxCell" style="font-size:.75rem;font-weight:650;color:#e0e8f0">-- V</span>
              </div>
            </div>`}
          </div>
        </div>
        <div class="st stm">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:1.0rem;line-height:1;flex-shrink:0">⚡</span>
            <div style="min-width:0">
              <div class="l">${this.config.label_remaining||'REMAINING'}</div>
              <div class="v" id="invRemCap" style="color:#3ce878;font-size:.75rem">-- Ah</div>
              <div id="invRemKwh" style="font-size:.70rem;font-weight:400;color:rgba(160,185,220,0.55);display:none">-- kWh</div>
            </div>
          </div>
        </div>
        <div class="st">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:1.0rem;line-height:1;flex-shrink:0">🔋</span>
            <div style="min-width:0">
              <div class="l">${this.config.label_today_batt_charge||'Charge'}</div>
              <div class="v" id="invTodayBattChg" style="color:#29b6f6;font-size:.75rem">-- kWh</div>
              <div class="l">${this.config.label_today_batt_discharge||'Discharge'}</div>
              <div class="v" id="invTodayBattDis" style="color:#29b6f6;font-size:.75rem">-- kWh</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Endurance row -->
      <div style="margin-top:8px">
        <div class="st" style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:1.43rem;line-height:1;flex-shrink:0;color:#ffffff">⏱</span>
            <span class="l" style="margin-bottom:0" id="bEnduStatLbl">${this.config.label_endurance||'ENDURANCE'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:14px">
            <span class="v" id="bEnduranceStat" style="color:#3ce878">--</span>
            <span id="bEndurancePower" style="font-size:.68rem;font-weight:500;color:rgba(160,185,220,0.85);white-space:nowrap"></span>
            <span id="bEnduranceTime" style="font-size:.62rem;font-weight:400;color:rgba(160,185,220,0.60);letter-spacing:.4px;white-space:nowrap">Till --</span>
          </div>
        </div>
      </div>
      ${this._buildExtraTilesHTML()}
      <div class="ct">&#x2014; INVERTER</div>
      <div class="pvf">
        <div class="pvi">
          <span class="ico">☀️</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase">Today PV</span>
          <span id="invTodayPv" style="font-size:.72rem;font-weight:650;color:#f4d03f">-- kWh</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-top:2px">Total PV</span>
          <span id="invTotalPv" style="font-size:.72rem;font-weight:650;color:#f4d03f">-- kWh</span>
        </div>
        <div class="pvi">
          <span class="ico">🔋</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase">Total Batt Charge</span>
          <span id="invTotalBattChg" style="font-size:.72rem;font-weight:650;color:#3fb950">-- kWh</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-top:2px">Total Batt Discharge</span>
          <span id="invTotalBattDis" style="font-size:.72rem;font-weight:650;color:#f39c4b">-- kWh</span>
        </div>
        <div class="pvi">
          <span class="ico">🔌</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase">Grid Export</span>
          <span id="invGridExport" style="font-size:.72rem;font-weight:650;color:#4ade80">-- kWh</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-top:2px">Grid Import</span>
          <span id="invGridImport" style="font-size:.72rem;font-weight:650;color:#f39c4b">-- kWh</span>
        </div>
        <div class="pvi">
          <span class="ico">🏡</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase">Today Load</span>
          <span id="invTodayLoad" style="font-size:.72rem;font-weight:650;color:#29b6f6">-- kWh</span>
          <span style="font-size:.52rem;color:rgba(200,215,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-top:2px">Total Load</span>
          <span id="invTotalLoad" style="font-size:.72rem;font-weight:650;color:#e0e8f0">-- kWh</span>
        </div>
      </div>

      ${(() => {
        const showCam = !!this.config._show_camera;
        const showSys = !!this.config._show_system;
        const showPlugs = !!this.config._show_smartplugs;
        const showClim  = !!this.config._show_climate;
        const showRooms = !!this.config._show_rooms;
        const showFridge = !!this.config._show_fridge;
        if (!showCam && !showSys && !showPlugs && !showClim && !showRooms && !showFridge) return '';
        return `
      <div class="ct">&#x2014; MONITORING</div>
      <div class="pvf" id="monRow1">${
        showCam ? `<div class="pvi mon-tile" data-popup="camera" style="cursor:pointer"><span class="ico">📷</span><span class="lbl">CAMERAS</span><span class="val" style="color:#4ade80;font-size:.68rem">LIVE</span></div>` : ''
      }${
        showSys ? `<div class="pvi mon-tile" data-popup="system" style="cursor:pointer"><span class="ico">🖥️</span><span class="lbl">SYSTEM</span><span class="val" style="color:#58a6ff;font-size:.68rem">STATS</span></div>` : ''
      }${
        showSys ? `<div class="pvi mon-tile" data-popup="inverter" style="cursor:pointer"><span class="ico">⚡</span><span class="lbl">INVERTER</span><span class="val" style="color:#f4d03f;font-size:.68rem">INFO</span></div>` : ''
      }${
        showSys ? `<div class="pvi mon-tile" data-popup="battery" style="cursor:pointer"><span class="ico">🔋</span><span class="lbl">BATTERY</span><span class="val" style="color:#3ce878;font-size:.68rem">DETAIL</span></div>` : ''
      }</div>${
        (showPlugs || showClim || showRooms || showFridge) ? `<div id="monRow2"><div class="pvf" style="margin-top:6px">${
          showPlugs ? `<div class="pvi mon-tile" data-popup="plugs" style="cursor:pointer"><span class="ico">🔌</span><span class="lbl">SMART PLUGS</span><span class="val" style="color:#f39c4b;font-size:.68rem">CTRL</span></div>` : ''
        }${
          showClim ? `<div class="pvi mon-tile" data-popup="climate" style="cursor:pointer"><span class="ico">🌡️</span><span class="lbl" id="monClimLabel">${this.config.clim_ac_name||'CLIMATE'}</span><span class="val" style="color:#29b6f6;font-size:.68rem">CTRL</span></div>` : ''
        }${
          showRooms ? `<div class="pvi mon-tile" data-popup="rooms" style="cursor:pointer"><span class="ico">🏠</span><span class="lbl">ROOMS</span><span class="val" style="color:#4ade80;font-size:.68rem">TEMP</span></div>` : ''
        }${
          showFridge ? `<div class="pvi mon-tile" data-popup="fridge" style="cursor:pointer"><span class="ico">🧊</span><span class="lbl" id="monFridgeLabel">${this.config.fridge_name||'FRIDGE'}</span><span class="val" style="color:#29b6f6;font-size:.68rem">COLD</span></div>` : ''
        }</div></div>` : ''
      }`;})()}
      </div><!-- /kfc-content -->
    </div><!-- /kfc-shell -->`;
  }

  // ─────────────────────────────────────────────────────────────
  // SKY SYSTEM � image-based background with dynamic sun, moon, stars, weather overlays
  // Images live at: /local/community/zee-skycard/sky/
  // Falls back to procedural CSS gradient if any image is missing (404).
  // ─────────────────────────────────────────────────────────────

  _skyImageKey(condition, isDay, bell) {
    // Dawn/dusk: elevation in 0-12 degree band → separate images
    const isDawn = isDay && bell < 0.22 && this._sunData().t < 0.5;
    const isDusk = isDay && bell < 0.22 && this._sunData().t >= 0.5;
    if (condition === 'clear' || condition === 'sunny') {
      if (isDawn) return 'sky-clear-dawn';
      if (isDusk) return 'sky-clear-dusk';
      return isDay ? 'sky-clear-day' : 'sky-night-clear';
    }
    if (condition === 'partlycloudy') return isDay ? 'sky-partlycloudy-day' : 'sky-partlycloudy-night';
    if (condition === 'cloudy')       return isDay ? 'sky-cloudy-day'       : 'sky-cloudy-night';
    if (condition === 'rainy')        return isDay ? 'sky-rainy-day'        : 'sky-rainy-night';
    if (condition === 'thunderstorm') return 'sky-thunderstorm';
    if (condition === 'snowy')        return 'sky-snowy-day';
    if (condition === 'fog')          return 'sky-fog-day';
    return isDay ? 'sky-clear-day' : 'sky-night-clear';
  }

  _renderSky(sun, condition = 'clear') {
    const skyDiv = this.shadowRoot?.getElementById('kfcSkyDiv');
    if (!skyDiv) return;
    const isDay = !sun.night;
    const bell  = sun.bell ?? 0.5;
    const BASE  = '/local/community/zee-skycard/sky';
    const key   = this._skyImageKey(condition, isDay, bell);

    // Skip full rebuild if key unchanged (saves DOM thrash every hass update)
    if (this._prevSkyKey === key) {
      this._updateSkyOverlays(skyDiv, sun, isDay, bell, condition, key);
      return;
    }
    this._prevSkyKey = key;

    // ── Base image layer ──
    // Two img elements for crossfade: A/B swap
    const prev = this._skySlot === 'A' ? 'B' : 'A';
    const curr = this._skySlot === 'A' ? 'A' : 'B';
    this._skySlot = curr;

    let html = `
      <!-- Fallback gradient (visible until image loads or if image 404s) -->
      <div id="kfcSkyGrad" style="position:absolute;inset:0;background:${this._fallbackGrad(isDay, bell, condition)};transition:background 1.4s ease"></div>
      <!-- Image layers A + B for crossfade -->
      <img id="kfcSkyImgA" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;border-radius:12px;opacity:0;transition:opacity 1.4s ease;pointer-events:none">
      <img id="kfcSkyImgB" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;border-radius:12px;opacity:0;transition:opacity 1.4s ease;pointer-events:none">
      <!-- Neutral dark fade � no colour tint on sky image bottom -->
      <div id="kfcSkyFade" style="position:absolute;bottom:0;left:0;right:0;height:70%;pointer-events:none;z-index:2;background:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,0.10) 100%)"></div>
      <!-- Star field (night only, SVG) -->
      <svg id="kfcStarSvg" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:58%;pointer-events:none;opacity:${isDay ? 0 : 1};transition:opacity 1.4s ease">
        ${isDay ? '' : this._starField(55)}
      </svg>
      <!-- Weather particle layer (rain/snow/lightning CSS) -->
      <div id="kfcWxLayer" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:12px"></div>
      <!-- Time-of-day colour tint -->
      <div id="kfcTint" style="position:absolute;inset:0;pointer-events:none;border-radius:12px"></div>
      <!-- Sun orb handled by SVG arcSunGroup � div hidden -->
      <div id="kfcSunOrb" style="display:none"></div>`;
    skyDiv.innerHTML = html;

    // Neutral dark fade � no colour tint on sky image bottom
    const fadeEl = skyDiv.querySelector('#kfcSkyFade');
    if (fadeEl) {
      fadeEl.style.background = `linear-gradient(to bottom,transparent 0%,rgba(0,0,0,0.10) 100%)`;
    }
    // Load image with crossfade
    const imgEl = skyDiv.querySelector('#kfcSkyImgA');
    if (imgEl) {
      imgEl.onload  = () => { imgEl.style.opacity = '1'; };
      imgEl.onerror = () => { imgEl.style.opacity = '0'; }; // fallback gradient shows through
      imgEl.src = `${BASE}/${key}.png`;
    }

    // Weather particle overlay
    this._buildWxLayer(skyDiv.querySelector('#kfcWxLayer'), condition, isDay);
    this._updateSkyOverlays(skyDiv, sun, isDay, bell, condition, key);
  }

  // Bottom-edge RGB sampled from actual PNG files (bottom 2%, center 60% width). PNGs are never modified.
  _skyEdgeRgb(skyKey) {
    const MAP = {
      'sky-clear-dawn':          [7, 30, 57],
      'sky-clear-day':           [0, 25, 56],
      'sky-clear-dusk':          [11, 33, 67],
      'sky-cloudy-day':          [35, 43, 51],
      'sky-cloudy-night':        [0, 12, 30],
      'sky-fog-day':             [119, 127, 139],
      'sky-night-clear':         [1, 8, 21],
      'sky-partlycloudy-day':    [2, 30, 65],
      'sky-partlycloudy-night':  [1, 6, 25],
      'sky-rainy-day':           [15, 19, 21],
      'sky-rainy-night':         [0, 5, 14],
      'sky-snowy-day':           [138, 146, 160],
      'sky-thunderstorm':        [1, 7, 16],
    };
    return MAP[skyKey] || [0, 25, 56];
  }

  _darkenRgb([r, g, b], amount = 0.10) {
    const f = 1 - amount;
    return [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
  }

  _applySkyBottomFill(skyKey) {
    const edge = this._skyEdgeRgb(skyKey);
    const dark = this._darkenRgb(edge, 0.10);
    const e = edge.join(',');
    const d = dark.join(',');
    const bottomGrad = this.shadowRoot?.getElementById('kfcBottomGrad');
    if (bottomGrad) {
      bottomGrad.style.background = `linear-gradient(180deg,rgb(${e}) 0%,rgb(${d}) 100%)`;
    }
    const shell = this.shadowRoot?.getElementById('kfcShell');
    if (shell) shell.style.background = `rgb(${d})`;
  }

  _updateSkyOverlays(skyDiv, sun, isDay, bell, condition, skyKey) {
    // Update fade overlay � neutral dark fade, no colour tint
    const fadeEl2 = skyDiv.querySelector('#kfcSkyFade');
    const key = skyKey || this._skyImageKey(condition, isDay, bell);
    const e = this._skyEdgeRgb(key).join(',');
    if (fadeEl2) {
      fadeEl2.style.background = `linear-gradient(to bottom,transparent 0%,rgba(${e},0.25) 72%,rgba(${e},0.92) 100%)`;
    }
    // ── Dynamic lower-section background � seamless match to PNG bottom ──
    this._applySkyBottomFill(key);
    // Sun orb position
    const sunOrb = skyDiv.querySelector('#kfcSunOrb');
    if (sunOrb) sunOrb.style.display = 'none';
    // Time-of-day colour tint over image
    const tint = skyDiv.querySelector('#kfcTint');
    if (tint) {
      if (isDay && bell < 0.28) {
        // Dawn / dusk warm tint � stronger near horizon
        const warmA = (0.18 - bell * 0.45).toFixed(3);
        const col   = sun.t < 0.5 ? `rgba(255,110,30,${warmA})` : `rgba(255,80,20,${warmA})`;
        tint.style.background = `linear-gradient(0deg,${col} 0%,rgba(255,90,20,${(parseFloat(warmA)*0.4).toFixed(3)}) 35%,transparent 68%)`;
      } else if (!isDay) {
        tint.style.background = 'linear-gradient(180deg,rgba(0,0,15,0.22) 0%,transparent 55%)';
      } else {
        tint.style.background = '';
      }
    }
  }


 
   _moonPhase() {
    // Exact new moon: 16 May 2026, 10:01 UTC
    const known = new Date('2026-05-16T10:01:00Z').getTime();
    const cycle = 29.530588853 * 24 * 3600 * 1000;
    return ((Date.now() - known) % cycle + cycle) % cycle / cycle;
}
   _moonSVG(phase) {
    const p     = ((phase % 1) + 1) % 1;
    const illum = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
    const r     = 26;
    const uid   = 'ms' + Math.abs(Math.round(p * 1000));

    if (illum < 0.01) {
      return `<circle cx="0" cy="0" r="${r}" fill="rgba(10,18,45,0.55)"/>`;
    }

    const full   = illum > 0.93;
    const waxing = p < 0.5;

    // CORRECT shadow geometry:
    // The dark region is a circle of the SAME radius r as the disc.
    // Its centre is offset along the x-axis so that its leading edge
    // lands exactly on the terminator of the moon phase.
    //   waxing (right side lit)  → shadow centre at NEGATIVE x
    //     cx_s = -r × (1 − cos(2πp))   [0 at new, −2r at full]
    //   waning (left side lit)   → shadow centre at POSITIVE x
    //     cx_s = +r × (1 − cos(2πp))
    // This is the geometrically exact formula; the original code used
    // −cos(p·π)·r which placed the shadow at the wrong position and
    // produced an inverted / wrong-phase crescent.
    const cx_s = (waxing ? -1 : 1) * r * (1 - Math.cos(p * Math.PI * 2));

    // Gradient highlight: shift to the lit side
    const gxPct = waxing ? '64%' : '36%';

    if (full) {
      return `
        <defs>
          <radialGradient id="${uid}sg" cx="50%" cy="28%" r="68%">
            <stop offset="0%" stop-color="#f8faff"/>
            <stop offset="45%" stop-color="#c8d0e0"/>
            <stop offset="100%" stop-color="#7a8090"/>
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${r}" fill="rgba(8,15,45,0.60)"/>
        <circle cx="0" cy="0" r="${r}" fill="url(#${uid}sg)"/>
        <circle cx="0" cy="0" r="${r}" fill="none" stroke="rgba(220,235,255,0.65)" stroke-width="1.5"/>`;
    }

    return `
      <defs>
        <radialGradient id="${uid}sg" cx="${gxPct}" cy="28%" r="68%">
          <stop offset="0%" stop-color="#f0f4ff"/>
          <stop offset="40%" stop-color="#c8d0e0"/>
          <stop offset="100%" stop-color="#7a8090"/>
        </radialGradient>
        <mask id="${uid}lm">
          <rect x="-50" y="-50" width="100" height="100" fill="black"/>
          <circle cx="0" cy="0" r="${r}" fill="white"/>
          <circle cx="${cx_s.toFixed(2)}" cy="0" r="${r}" fill="black"/>
        </mask>
      </defs>
      <circle cx="0" cy="0" r="${r}" fill="rgba(8,15,45,0.60)"/>
      <circle cx="0" cy="0" r="${r}" fill="url(#${uid}sg)" mask="url(#${uid}lm)"/>
      <circle cx="0" cy="0" r="${r}" fill="none" stroke="rgba(220,235,255,0.55)" stroke-width="1.5" mask="url(#${uid}lm)"/>`;
}

  _starField(count) {
    let seed = Math.floor(Date.now() / 86400000);
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    const COLORS = ['#ffffff','#ffffff','#e8eeff','#ffe8d0','#ffd0a0','#ccdeff','#fff8e8','#d0e8ff'];
    let svg = '';
    for (let i = 0; i < count; i++) {
      const x   = (rng() * 100).toFixed(2);
      const y   = (rng() * 92).toFixed(2);
      const r   = (0.4 + rng() * 1.5).toFixed(2);
      const op  = (0.18 + rng() * 0.70).toFixed(2);
      const col = COLORS[Math.floor(rng() * COLORS.length)];
      const twk = rng() > 0.80;
      const dur = (1.6 + rng() * 2.8).toFixed(1);
      svg += `<circle cx="${x}%" cy="${y}%" r="${r}" fill="${col}" opacity="${op}"${twk ? ` style="animation:kfcTwinkle ${dur}s ease-in-out infinite;animation-delay:-${(rng()*parseFloat(dur)).toFixed(1)}s"` : ''}/>`;
    }
    return svg;
  }

  _buildWxLayer(el, condition, isDay) {
    if (!el) return;
    let html = '';
    if (condition === 'rainy' || condition === 'thunderstorm') {
      const count = condition === 'thunderstorm' ? 55 : 38;
      for (let i = 0; i < count; i++) {
        const l = (i * 79 % 100).toFixed(1);
        const h = (1 + (i % 3) * 0.5).toFixed(1);
        const d = (0.45 + (i % 6) * 0.08).toFixed(2);
        const op = (0.25 + (i % 4) * 0.08).toFixed(2);
        const delay = -((i * 0.11) % parseFloat(d)).toFixed(2);
        html += `<div style="position:absolute;top:0;left:${l}%;width:${h}px;height:14px;background:rgba(180,210,255,${op});border-radius:1px;animation:kfcRain ${d}s linear ${delay}s infinite"></div>`;
      }
      if (condition === 'thunderstorm') {
        html += `<div style="position:absolute;inset:0;background:rgba(200,220,255,0.04);animation:kfcLightning 5.8s ease-in-out infinite"></div>`;
      }
    }
    if (condition === 'snowy') {
      for (let i = 0; i < 38; i++) {
        const l = (i * 83 % 100).toFixed(1);
        const s = 2 + (i % 4);
        const d = (2.8 + (i % 5) * 0.6).toFixed(1);
        const delay = -((i * 0.4) % parseFloat(d)).toFixed(1);
        const op = (0.35 + (i % 3) * 0.12).toFixed(2);
        html += `<div style="position:absolute;top:0;left:${l}%;width:${s}px;height:${s}px;border-radius:50%;background:rgba(228,240,255,${op});animation:kfcSnow ${d}s ease-in-out ${delay}s infinite"></div>`;
      }
    }
    if (condition === 'fog') {
      const fc = isDay ? 'rgba(172,198,212,' : 'rgba(88,118,142,';
      for (let i = 0; i < 5; i++) {
        const top  = 8 + i * 9;
        const dur  = (7 + i * 2).toFixed(1);
        const ddur = (parseFloat(dur) * 2.8).toFixed(0);
        const op   = (0.22 + (i % 3) * 0.07).toFixed(2);
        const h    = 14 + (i % 3) * 8;
        html += `<div style="position:absolute;top:${top}%;left:-10%;right:-10%;height:${h}px;background:linear-gradient(90deg,transparent,${fc}${op}),${fc}${op}),transparent);filter:blur(${2+i}px);animation:kfcFogDrift ${ddur}s ease-in-out -${(i*2.1).toFixed(1)}s infinite alternate"></div>`;
      }
    }
    el.innerHTML = html;
  }


  _fallbackGrad(isDay, bell, condition) {
    if (!isDay) return 'linear-gradient(180deg,#000308 0%,#010818 28%,#020c28 55%,#050f38 78%,#0a1545 100%)';
    if (condition === 'rainy' || condition === 'thunderstorm') return 'linear-gradient(180deg,#0e1820 0%,#182838 40%,#243a4c 68%,#304858 100%)';
    if (condition === 'cloudy') return 'linear-gradient(180deg,#1a3a50 0%,#2e5870 32%,#4a80a0 58%,#78b0cc 78%,#aaced8 100%)';
    if (bell < 0.22) return 'linear-gradient(180deg,#001a50 0%,#0a3070 20%,#3060a0 45%,#e0703a 72%,#f0a050 88%,#f8d080 100%)';
    return 'linear-gradient(180deg,#003a8c 0%,#0055b3 18%,#1470cc 40%,#3d9de8 62%,#8ac8f5 80%,#c8e8fa 92%,#f0d8a0 100%)';
  }

  _updateDynamic() {
    if (!this._hass || !this.config) return;
    const root = this.shadowRoot;
    const getEl = (id) => root.getElementById(id);
    const setText = (id, txt) => { const el = getEl(id); if (el) el.textContent = txt; };
    const setAttr = (id, attr, val) => { const el = getEl(id); if (el) el.setAttribute(attr, val); };

    // ── Lower section vertical offset (arc stays fixed) ──
    const lowerSec = getEl('lowerSection');
    if (lowerSec) {
      const offset = Number(this.config.lower_section_offset) || 0;
      lowerSec.setAttribute('transform', `translate(0,${offset})`);
    }

    // ── Threshold constants — parsed once, reused everywhere (no scattered Number() coercions) ──
    const THR = {
      tempWarn:      Number(this.config.thresh_temp_warn)       || 40,
      tempCrit:      Number(this.config.thresh_temp_critical)   || 50,
      cellVLow:      Number(this.config.thresh_cell_v_low)      || 3.1,
      cellVCrit:     Number(this.config.thresh_cell_v_critical) || 3.0,
      cellVHigh:     Number(this.config.thresh_cell_v_high)     || 3.65,
      socLow:        Number(this.config.thresh_soc_low)         || 25,
      socCrit:       Number(this.config.thresh_soc_critical)    || 15,
      loadWarn:      Number(this.config.thresh_load_warn)       || 70,
      loadCrit:      Number(this.config.thresh_load_critical)   || 90,
      endurLow:      Number(this.config.thresh_endurance_low)   || 2,
      endurCrit:     Number(this.config.thresh_endurance_crit)  || 1,
    };

    // Fix #4: use null-aware helper so unavailable/unknown sensors show '--' not '0'
    const _n = (v, fallback = 0) => (v !== null && !isNaN(v)) ? v : fallback;
    const _nullOr0 = (v) => (v !== null && !isNaN(v)) ? v : 0; // for flow/direction values where 0 is valid

    // Temperature unit helpers — read the sensor's own unit (°C/°F) so non-Celsius
    // users get correct labels. Thresholds stay °C-based; values are normalized.
    const _unitOf = (eid, fb) => {
      const s = eid && this._hass && this._hass.states[eid];
      const u = s && s.attributes && s.attributes.unit_of_measurement ? String(s.attributes.unit_of_measurement).trim() : '';
      return u || fb;
    };
    const _isF = (u) => u === '°F' || u === 'F' || u === '℉';
    const _tc = (v, u) => _isF(u) ? (v - 32) * 5 / 9 : v; // normalize to °C for threshold checks
    const _ft = (v, u) => v.toFixed(1) + ' ' + u;         // format with the sensor's own unit

    // Declare labelsOn early — used by _invTileSet closure defined below (must precede it)
    const labelsOn = !!(this.config._labels_custom_entities);

    const pv1 = _n(this._val(this.config.pv1_power, true));
    const pv2 = _n(this._val(this.config.pv2_power, true));
    const pv3 = this.config._show_pv_extra ? _n(this._val(this.config.pv3_power, true)) : 0;
    const pv4 = this.config._show_pv_extra ? _n(this._val(this.config.pv4_power, true)) : 0;
    const totalPvSensor = this._val(this.config.pv_total_power, true);
    const pvTotal = (totalPvSensor !== null && !isNaN(totalPvSensor) && totalPvSensor > 0) ? totalPvSensor : pv1 + pv2 + pv3 + pv4;
    const _gridPrimary = this._val(this.config.grid_active_power, true);
    let gridActive = _gridPrimary !== null ? _gridPrimary : _nullOr0(this._val(this.config.grid_power_alt, true));
    if (this.config.invert_grid_power) gridActive = -gridActive;
    const load = _n(this._val(this.config.consump, true));
    const battSoc1 = _n(this._val(this.config.battery_soc) ?? this._val(this.config.goodwe_battery_soc));
    let battPwr1 = _nullOr0(this._val(this.config.battery_power, true));
    if (this.config.invert_battery_power) battPwr1 = -battPwr1;
    let battCurr1 = _nullOr0(this._val(this.config.battery_current) ?? this._val(this.config.goodwe_battery_curr));
    if (this.config.invert_battery_power) battCurr1 = -battCurr1;
    const battVolt1 = _n(this._val(this.config.battery_voltage));
    const temp1_1 = _n(this._val(this.config.battery_temp1));
    const temp2_1 = _n(this._val(this.config.battery_temp2));
    const mos1 = _n(this._val(this.config.battery_mos));
    const minCell1 = _n(this._val(this.config.battery_min_cell));
    const maxCell1 = _n(this._val(this.config.battery_max_cell));
    const invTemp = _n(this._val(this.config.inv_temp));

    // System limits – direct numbers
    // battery_cap_unit: 'ah' uses battery_full_ah; 'kwh' uses battery_full_wh (stored as kWh, converted to Wh internally)
    const capUnit = this.config.battery_cap_unit || 'ah';
    const fullAh  = capUnit === 'ah'  ? (Number(this.config.battery_full_ah)  || 0) : 0;
    // battVolt1 already declared above — use directly for Ah→Wh conversion (DRY)
    const fullWh  = capUnit === 'kwh' ? (Number(this.config.battery_full_wh) || 0) * 1000
                                      : (fullAh > 0 && battVolt1 > 0 ? fullAh * battVolt1 : 0);
    const invMax = Math.max(1, Number(this.config.inverter_max_power) || 6000);
    const pvMax  = Number(this.config.pv_max_power) || 7500;

    const remCap1 = fullAh > 0 ? (battSoc1 / 100) * fullAh : 0;
    // Fix #14: dual-battery charging ETA � battery2_full_wh entered in kWh, ×1000 for internal Wh
    const fullWh2 = Number(this.config.battery2_full_wh) > 0 ? Number(this.config.battery2_full_wh) * 1000 : fullWh;

    const dual = !!(this.config._show_battery2);
    const battSoc2 = dual ? _n(this._val(this.config.battery2_soc)) : 0;
    let battPwr2 = dual ? _nullOr0(this._val(this.config.battery2_power, true)) : 0;
    let battCurr2 = dual ? _nullOr0(this._val(this.config.battery2_current)) : 0;
    if (dual && this.config.invert_battery_power) { battPwr2 = -battPwr2; battCurr2 = -battCurr2; }
    const battVolt2 = dual ? _n(this._val(this.config.battery2_voltage)) : 0;
    const mos2 = dual ? _n(this._val(this.config.battery2_mos)) : 0;

    const chargerPower = _n(this._val(this.config.charger_power, true));
    const chargerCurrent = _n(this._val(this.config.charger_current));
    const chargerSoc = _n(this._val(this.config.charger_soc));
    const chargerEtaSensor = this._val(this.config.charger_eta);
    const chargerBattCapWh = Number(this.config.charger_battery_capacity_wh) || 0;
    const chargerStateStr = this._strVal(this.config.charger_state);

    const sun = this._sunData();
    const auraEl = getEl('skyAura');
    if (auraEl) auraEl.setAttribute('cy', (94 - Math.round((sun.bell || 0.5) * 22)).toString());

    // ── Sun arc labels, sun dot position & night dimming ──
    const sunRiseLbl = getEl('sunRiseLabel');
    const sunSetLbl  = getEl('sunSetLabel');
    if (sunRiseLbl) sunRiseLbl.textContent = sun.rise;
    if (sunSetLbl)  sunSetLbl.textContent  = sun.set;
    const arcEl = getEl('sunArcTrack');
    if (arcEl) arcEl.setAttribute('opacity', sun.night ? '0.15' : '0.50');

    // ── Pure-SVG sun: update position + scale per elevation, zero square artefact ──
    getEl('arcSunGroup')?.setAttribute('opacity', sun.night ? '0' : '1');
    if (!sun.night) {
      const bell = sun.bell ?? 0.5;
      const coreR   = Math.round(14 + bell * 8);         // 14 (horizon) → 22 (zenith)
      const rL1     = Math.round(coreR * 1.7);
      const rL2     = Math.round(coreR * 2.9);
      const rL3     = Math.round(coreR * 5.8);
      const rL4     = Math.round(coreR * 11);
      // Colour temperature: deep orange at horizon → white at zenith
      // Radial gradient stop colors (center color; outer fades to transparent via gradient)
      const c1stop = bell < 0.15 ? 'rgba(255,220,120,1)'  : 'rgba(255,255,220,1)';
      const c2stop = bell < 0.15 ? 'rgba(255,180,60,1)'   : 'rgba(255,240,160,1)';
      const c3stop = bell < 0.15 ? 'rgba(255,120,20,1)'   : 'rgba(255,210,80,1)';
      const c4stop = bell < 0.15 ? 'rgba(255,80,0,1)'     : 'rgba(255,170,30,1)';
      const o1 = (0.75 + bell * 0.20).toFixed(2);
      const o2 = (0.45 + bell * 0.20).toFixed(2);
      const o3 = (0.22 + bell * 0.12).toFixed(2);
      const o4 = (0.10 + bell * 0.08).toFixed(2);
      const coreInner = bell < 0.15 ? '#fff4d0' : '#ffffff';
      const coreMid   = bell < 0.15 ? '#ffd060' : '#fffbe8';
      const coreOuter = bell < 0.15 ? '#ff8020' : '#ffe090';
      // Move all layers to current sun position
      ['sunL4','sunL3','sunL2','sunL1','sunCore'].forEach(id => {
        const e = getEl(id); if (!e) return;
        e.setAttribute('cx', sun.bx); e.setAttribute('cy', sun.by);
      });
      const sl4 = getEl('sunL4');
      if (sl4) { sl4.setAttribute('r', rL4); sl4.setAttribute('opacity', o4); }
      const sl3 = getEl('sunL3');
      if (sl3) { sl3.setAttribute('r', rL3); sl3.setAttribute('opacity', o3); }
      const sl2 = getEl('sunL2');
      if (sl2) { sl2.setAttribute('r', rL2); sl2.setAttribute('opacity', o2); }
      const sl1 = getEl('sunL1');
      if (sl1) { sl1.setAttribute('r', rL1); sl1.setAttribute('opacity', o1); }
      const sCore = getEl('sunCore');
      if (sCore) { sCore.setAttribute('r', coreR); }
      // Update radial gradient stop colours per elevation/time
      const _updGrad = (gradId, centerColor) => {
        const g = root.getElementById(gradId);
        if (!g) return;
        const stops = g.querySelectorAll('stop');
        if (stops[0]) stops[0].setAttribute('stop-color', centerColor);
        // stop[1] always transparent version of same hue — derive it
        const transparentVer = centerColor.replace(/,1\)$/, ',0)');
        if (stops[1]) stops[1].setAttribute('stop-color', transparentVer);
      };
      _updGrad('sunGlowG1', c1stop);
      _updGrad('sunGlowG2', c2stop);
      _updGrad('sunGlowG3', c3stop);
      _updGrad('sunGlowG4', c4stop);
      // Update core gradient stop colours
      const sg = root.getElementById('sunCoreGD');
      if (sg) {
        const stops = sg.querySelectorAll('stop');
        if (stops[0]) stops[0].setAttribute('stop-color', coreInner);
        if (stops[1]) stops[1].setAttribute('stop-color', coreMid);
        if (stops[2]) stops[2].setAttribute('stop-color', coreOuter);
      }
    }

    // Moon position — rebuild SVG only when phase changes meaningfully (>0.5%)
    const moonSvgGroup = getEl('moonSvgGroup');
    if (sun.night) {
      if (moonSvgGroup) {
        moonSvgGroup.setAttribute('transform', `translate(${sun.mx},${sun.my})`);
        moonSvgGroup.setAttribute('opacity', '1');
        const currentPhase = this._moonPhase();
        if (Math.abs(currentPhase - this._prevMoonPhase) > 0.005) {
          this._prevMoonPhase = currentPhase;
          const inner = this.shadowRoot.getElementById('moonSvgInner');
          if (inner) inner.innerHTML = this._moonSVG(currentPhase);
        }
      }
    } else {
      this._prevMoonPhase = -1; // reset so night re-entry always redraws
      if (moonSvgGroup) moonSvgGroup.setAttribute('opacity', '0');
    }

    // PV wave: double-buffer A/B swap for zero-flicker rebuilds.
    // Write new HTML into the hidden slot, then instantly swap opacity.
    // The active slot keeps rendering continuously — zero frames with empty group.
    // Rebuild only on tier boundary, geometry change, or on/off threshold.
    const _pvTier = pvTotal <= 10 ? 0
      : pvTotal < 200  ? 1 : pvTotal < 600  ? 2 : pvTotal < 1200 ? 3
      : pvTotal < 2500 ? 4 : pvTotal < 4000 ? 5 : pvTotal < 6000 ? 6 : 7;
    const _pvWaveNeedsRebuild = _pvTier !== this._prevPvTier
      || sun.bx !== this._prevPvWaveBx
      || sun.by !== this._prevPvWaveBy;
    if (_pvWaveNeedsRebuild) {
      this._prevPvTier   = _pvTier;
      this._prevPvWaveBx = sun.bx;
      this._prevPvWaveBy = sun.by;
      this._prevPvTotal  = pvTotal;
      this._prevSunPos   = { bx: sun.bx, by: sun.by };
      // Determine which slot is currently visible and which is hidden
      const activeSlot = this._pvSlot;          // currently shown
      const nextSlot   = activeSlot === 'A' ? 'B' : 'A';  // write target
      const nextGroup  = getEl('pvFlowGroup' + nextSlot);
      const activeGroup = getEl('pvFlowGroup' + activeSlot);
      if (nextGroup && activeGroup) {
        // 1. Build into hidden slot (no visual effect)
        nextGroup.innerHTML = this._buildPvWaveHTML(sun.bx, sun.by, pvTotal);
        // 2. Swap: show next, hide active — atomic from browser compositor perspective
        nextGroup.setAttribute('opacity', '1');
        activeGroup.setAttribute('opacity', '0');
        this._pvSlot = nextSlot;
      }
    }

    // ── PV power bubble: floats just right of sun, shows live kW ──
    const pvBubbleG = getEl('pvBubbleGroup');
    if (pvBubbleG) {
      const pvKw = pvTotal >= 1000 ? (pvTotal / 1000).toFixed(2) + ' kW' : pvTotal.toFixed(0) + ' W';
      const pvShow = pvTotal > 10 && !sun.night;
      pvBubbleG.setAttribute('opacity', pvShow ? '1' : '0');
      if (pvShow) {
        // Banner is 104×28, sharp bottom-left. Position so it clears the sun glow.
        const bx = Math.min(sun.bx + 22, 406);
        const by = Math.max(sun.by - 28, 0);
        pvBubbleG.setAttribute('transform', `translate(${bx},${by})`);
        const txtEl = getEl('pvBubbleVal');
        if (txtEl) txtEl.textContent = pvKw + ' ⚡';
      }
    }

    const flowDur = (w) => Math.max(0.5, 3.0 - (Math.min(Math.abs(w), 8000) / 8000) * 2.5).toFixed(2) + 's';
    const _colorToMarker = (c) => {
      if (c === '#e07800') return 'url(#arrowOrange)';
      if (c === '#39ff14') return 'url(#arrowGreen)';
      if (c === '#9ca3af') return 'url(#arrowGray)';
      if (c === '#00f0ff') return 'url(#arrowCyan)';
      return 'url(#arrowGreen)';
    };
    const setFlow = (id, show, watts, durStr, color) => {
      const el = getEl(id); if (!el) return;
      el.setAttribute('opacity', show ? '1' : '0'); el.style.display = show ? '' : 'none';
      if (show && durStr !== undefined) { const anim = el.querySelector('animate'); if (anim) anim.setAttribute('dur', durStr); }
      if (color !== undefined) {
        el.setAttribute('stroke', color);
        // Update marker color on the 'C' (core) line elements
        if (id.endsWith('C')) el.setAttribute('marker-end', _colorToMarker(color));
      }
    };

    const absPwr1 = Math.abs(battPwr1);
    const isCharging1  = battPwr1 > 50;
    const battIdle     = absPwr1 < 50;
    // Battery: charging = neon green, discharging = dark orange
    const battIdleColor = '#9ca3af';
    const battChgColor  = '#39ff14';
    const battDisColor  = '#e07800';
    const battLineColor = battIdle ? battIdleColor : (isCharging1 ? battChgColor : battDisColor);
    const battShowIn    = battPwr1 > 50;
    const battShowOut   = battPwr1 < -50;
    const battDur       = battIdle ? '4.0s' : flowDur(absPwr1);

    setFlow('flowBattIn',   battShowIn,  absPwr1, battDur, battLineColor);
    setFlow('flowBattInC',  battShowIn,  absPwr1, battDur, battLineColor);
    setFlow('flowBattOut',  battShowOut, absPwr1, battDur, battLineColor);
    setFlow('flowBattOutC', battShowOut, absPwr1, battDur, battLineColor);
    // Grid: importing = dark orange, exporting = neon green; hidden when inactive
    const gridImportingActive = gridActive > 10;
    const gridExportingActive = gridActive < -10;
    const gridInColor  = '#e07800';   // dark orange for import
    const gridOutColor = '#39ff14';   // neon green for export
    setFlow('flowGridIn',   gridImportingActive, gridActive,           flowDur(gridActive),            gridInColor);
    setFlow('flowGridInC',  gridImportingActive, gridActive,           flowDur(gridActive),            gridInColor);
    setFlow('flowGridOut',  gridExportingActive, Math.abs(gridActive), flowDur(Math.abs(gridActive)),  gridOutColor);
    setFlow('flowGridOutC', gridExportingActive, Math.abs(gridActive), flowDur(Math.abs(gridActive)),  gridOutColor);

    // Grid pylon glow — orange when importing or exporting


    const absGridActive = Math.abs(gridActive);
    const absBattOut    = battPwr1 < -10 ? Math.abs(battPwr1) : 0;
    const absPvLoad     = pvTotal > 10 ? pvTotal : 0;
    let loadFlowColor = '#ffe83c';
    if (absGridActive > 10 && absGridActive >= absPvLoad && absGridActive >= absBattOut) {
      loadFlowColor = '#FF2929';
    } else if (absBattOut > 10 && absBattOut >= absPvLoad && absBattOut >= absGridActive) {
      loadFlowColor = absBattOut < 1000 ? '#f39c4b' : absBattOut < 2500 ? '#e67e22' : '#f85149';
    }

    const _battFlowW = absPwr1 >= 1000 ? ' ' + (absPwr1 / 1000).toFixed(1) + ' kW' : ' ' + absPwr1.toFixed(0) + ' W';
    // Battery flow label: bright white always; "IDLE" when <40W
    const _battFlowDisplay = battIdle ? 'IDLE' : _battFlowW;
    const _battFlowColor = battIdle ? '#9ca3af' : '#ffffff';
    const fcBattFlowEl = getEl('fcBattFlowVal');
    if (fcBattFlowEl) { fcBattFlowEl.textContent = _battFlowDisplay; fcBattFlowEl.setAttribute('fill', _battFlowColor); }

    // Grid formatting — declared here (before first use) to avoid TDZ ReferenceError
    const gridCol = gridActive > 10 ? '#ef4444' : gridActive < -10 ? '#4ade80' : '#4a5568';
    const gridDir = gridActive > 10 ? '▼ ' : gridActive < -10 ? '▲ ' : '';
    const gridTxtFmt = absGridActive >= 1000 ? ' ' + (absGridActive / 1000).toFixed(1) + ' kW' : ' ' + absGridActive.toFixed(0) + ' W';

    // Grid flow mid-label removed — power shown in GRID col below
    const gridIsActive = absGridActive > 10;

    const battIconWrap = getEl('battIconWrap');
    if (battIconWrap) { battIconWrap.setAttribute('filter', absPwr1 >= 50 ? 'url(#iconGlowBlue)' : ''); }

    // Battery fill & stats
    if (dual) {
      const fill1 = this._battFill(battSoc1); const fill2 = this._battFill(battSoc2);
      const bf1 = getEl('battFillBar1'); if (bf1) { bf1.setAttribute('y', fill1.y); bf1.setAttribute('height', fill1.height); bf1.setAttribute('fill', fill1.color); bf1.setAttribute('filter', fill1.filter); }
      const bh1 = getEl('battFillHL1'); if (bh1) { bh1.setAttribute('y', fill1.y); bh1.setAttribute('height', fill1.height); }
      const bf2 = getEl('battFillBar2'); if (bf2) { bf2.setAttribute('y', fill2.y); bf2.setAttribute('height', fill2.height); bf2.setAttribute('fill', fill2.color); bf2.setAttribute('filter', fill2.filter); }
      const bh2 = getEl('battFillHL2'); if (bh2) { bh2.setAttribute('y', fill2.y); bh2.setAttribute('height', fill2.height); }
      setText('fcBattVal1', battSoc1 + '%'); setAttr('fcBattVal1', 'fill', fill1.textColor);
      setText('fcBattVal2', battSoc2 + '%'); setAttr('fcBattVal2', 'fill', fill2.textColor);
      const voltTopElD = getEl('fcBattVoltTop');
      if (voltTopElD) { voltTopElD.textContent = battVolt1.toFixed(1) + ' / ' + battVolt2.toFixed(1) + ' V'; voltTopElD.setAttribute('fill','#ffffff'); }
      const currBelowElD = getEl('fcBattCurrBelow');
      if (currBelowElD) { currBelowElD.textContent = battCurr1.toFixed(1) + ' / ' + battCurr2.toFixed(1) + ' A'; currBelowElD.setAttribute('fill','#ffffff'); }
      const bolt1 = getEl('battBoltGroup1'), bolt2 = getEl('battBoltGroup2');
      if (bolt1) bolt1.setAttribute('opacity', battPwr1 > 10 ? '1' : '0');
      if (bolt2) bolt2.setAttribute('opacity', battPwr2 > 10 ? '1' : '0');
    } else {
      const fill = this._battFill(battSoc1);
      const bf = getEl('battFillBar'); if (bf) { bf.setAttribute('y', fill.y); bf.setAttribute('height', fill.height); bf.setAttribute('fill', fill.color); bf.setAttribute('filter', fill.filter); }
      const bh = getEl('battFillHL'); if (bh) { bh.setAttribute('y', fill.y); bh.setAttribute('height', fill.height); }
      setText('fcBattVal', battSoc1 + '%'); setAttr('fcBattVal', 'fill', fill.textColor);
      const bolt = getEl('battBoltGroup'); if (bolt) bolt.setAttribute('opacity', battPwr1 > 10 ? '1' : '0');
      const voltTopEl = getEl('fcBattVoltTop');
      if (voltTopEl) { voltTopEl.textContent = battVolt1.toFixed(1) + ' V'; voltTopEl.setAttribute('fill','#ffffff'); }
      const currBelowEl = getEl('fcBattCurrBelow');
      if (currBelowEl) { currBelowEl.textContent = battCurr1.toFixed(1) + ' A'; currBelowEl.setAttribute('fill','#ffffff'); }
    }

    // Color and value for cell tiles � handled by label override block below

    // Endurance � works in both Ah mode (needs voltage to get Wh) and kWh mode (direct)
    let endHours = null, endText = '--', endColor = '#8b949e', isETA = false;
    if (dual) {
      const totalRemWh = (battSoc1 / 100) * fullWh + (battSoc2 / 100) * fullWh2;
      const totalCapWh = fullWh + fullWh2;
      const totalPower = battPwr1 + battPwr2;
      if (totalCapWh > 0) {
        if (totalPower < -10) {
          endHours = totalRemWh / Math.abs(totalPower);
          endText = this._fmtEndurance(endHours); endColor = this._remCapColor(battSoc1);
        } else if (totalPower > 10) {
          const missingWh = totalCapWh - totalRemWh;
          endHours = Math.max(0, missingWh / totalPower);
          endText = this._fmtEndurance(endHours); endColor = '#00d7ff'; isETA = true;
        }
      }
    } else {
      // simpler: remWh from SOC × fullWh; if fullWh=0 (not configured), try Ah×V fallback
      const remWhFinal = fullWh > 0 ? (battSoc1 / 100) * fullWh
                                    : (fullAh > 0 && battVolt1 > 0 ? remCap1 * battVolt1 : 0);
      if (battPwr1 < -10 && remWhFinal > 0) {
        endHours = remWhFinal / Math.abs(battPwr1);
        endText = this._fmtEndurance(endHours); endColor = this._remCapColor(battSoc1);
      } else if (battPwr1 > 10) {
        const capWh = fullWh > 0 ? fullWh : (fullAh > 0 && battVolt1 > 0 ? fullAh * battVolt1 : 0);
        if (capWh > 0) {
          const missingWh = capWh - remWhFinal;
          endHours = Math.max(0, missingWh / Math.abs(battPwr1));
          endText = this._fmtEndurance(endHours); endColor = '#00d7ff'; isETA = true;
        }
      }
    }
    const pwrPct = Math.min(absPwr1 / invMax * 100, 100);
    const pwrBar = getEl('pwrBar');
    if (pwrBar) {
      pwrBar.style.width = pwrPct.toFixed(1) + '%';
      pwrBar.style.background = absPwr1 < 50 ? '#8b949e' : isCharging1 ? '#2b59ff' :
        `linear-gradient(to right, #f4d03f, #f39c4b ${(pwrPct * 0.5).toFixed(0)}%, #f85149)`;
    }
    const pwrPctEl = getEl('pwrPct');
    if (pwrPctEl) {
      pwrPctEl.textContent = pwrPct.toFixed(0) + '%';
      pwrPctEl.style.color = absPwr1 < 50 ? '#8b949e' : isCharging1 ? '#2b59ff' : '#f39c4b';
    }
    const badge = getEl('battStatusBadge');
    if (badge) { badge.textContent = absPwr1 < 50 ? 'IDLE' : isCharging1 ? 'CHG' : 'DISCHG'; badge.style.color = absPwr1 < 50 ? '#8b949e' : isCharging1 ? '#00d7ff' : '#3ce878'; }

    setText('invTempFlow', _ft(invTemp, _unitOf(this.config.inv_temp, '°C')));
    setText('invNameLabel', this.config.inverter_name || 'INV');
    setAttr('invTempFlow', 'fill', _tc(invTemp, _unitOf(this.config.inv_temp, '°C')) >= THR.tempCrit ? '#ef4444' : _tc(invTemp, _unitOf(this.config.inv_temp, '°C')) >= THR.tempWarn ? '#f59e0b' : '#e0e8f0');
    // Inverter banner visibility toggle
    const _invBannerGroup = getEl('fcInvBannerGroup');
    if (_invBannerGroup) _invBannerGroup.style.display = this.config._show_inv_banner === false ? 'none' : '';
    const invLoadPct = load > 0 ? Math.min(load / invMax * 100, 100) : 0;
    const _loadColor = invLoadPct >= THR.loadCrit ? '#ef4444' : invLoadPct >= THR.loadWarn ? '#f59e0b' : (load > 10 ? '#e0e8f0' : '#4a5568');
    // Restore load% in INV badge
    const invLoadPctEl = getEl('invLoadPctFlow');
    if (invLoadPctEl) {
      invLoadPctEl.textContent = load > 10 ? invLoadPct.toFixed(0) + '%' : '--%';
      invLoadPctEl.setAttribute('fill', _loadColor);
    }
    // Load shown in battery column as headline value
    const _loadFcEl = getEl('fcLoadVal');
    if (_loadFcEl) {
      _loadFcEl.textContent = load > 0 ? (load >= 1000 ? ' ' + (load / 1000).toFixed(1) + ' kW' : ' ' + load.toFixed(0) + ' W') : (this.config.consump ? '-- W' : '--');
      _loadFcEl.setAttribute('fill', _loadColor);
    }
    // Load voltage (right of load power) — mirrors the grid-voltage readout
    const _loadVoltEl = getEl('fcLoadVoltVal');
    if (_loadVoltEl) {
      const _lvEntityId = this.config.load_voltage || '';
      const _lvState = _lvEntityId && this._hass?.states[_lvEntityId];
      const _lvVal = _lvState && _lvState.state !== 'unavailable' && _lvState.state !== 'unknown'
        ? parseFloat(_lvState.state) : null;
      _loadVoltEl.textContent = (_lvVal !== null && !isNaN(_lvVal)) ? _lvVal.toFixed(0) + ' V' : '-- V';
      _loadVoltEl.setAttribute('fill', load > 0 ? 'rgba(200,220,255,0.75)' : 'rgba(180,190,210,0.35)');
    }

    // Grid flow labels — power above flowGridIn, voltage below (mirrors the battery flow)
    // Bottom GRID column shows the same single power + voltage (fcGridVal / fcGridVoltVal).
    const phase3Group = getEl('grid3PhaseVertical');
    const _show3ph    = !!(this.config._show_3phase);
    const _setGridPower = (el) => {
      if (!el) return;
      if (!gridIsActive) {
        el.setAttribute('fill', 'rgba(180,190,210,0.35)');
        el.textContent = '0 W';
      } else {
        el.setAttribute('fill', gridCol);
        el.textContent = gridDir + gridTxtFmt;
      }
      el.setAttribute('opacity', _show3ph ? '0' : '1');
    };
    const _setGridVolt = (el) => {
      if (!el) return;
      const _gvEntityId = this.config.grid_voltage || '';
      const _gvState = _gvEntityId && this._hass?.states[_gvEntityId];
      const _gvVal = _gvState && _gvState.state !== 'unavailable' && _gvState.state !== 'unknown'
        ? parseFloat(_gvState.state) : null;
      el.textContent = (_gvVal !== null && !isNaN(_gvVal)) ? _gvVal.toFixed(0) + ' V' : '-- V';
      el.setAttribute('fill', gridIsActive ? 'rgba(200,220,255,0.75)' : 'rgba(180,190,210,0.35)');
      el.setAttribute('opacity', _show3ph ? '0' : '1');
    };
    _setGridPower(getEl('fcGridVal'));
    _setGridPower(getEl('fcGridFlowVal'));
    _setGridVolt(getEl('fcGridVoltVal'));
    _setGridVolt(getEl('fcGridFlowVolt'));
    // Grid frequency (next to grid voltage)
    const gridFreqEl = getEl('fcGridFreqVal');
    if (gridFreqEl) {
      const _gfEntityId = this.config.grid_frequency || '';
      const _gfState = _gfEntityId && this._hass?.states[_gfEntityId];
      const _gfVal = _gfState && _gfState.state !== 'unavailable' && _gfState.state !== 'unknown'
        ? parseFloat(_gfState.state) : null;
      gridFreqEl.textContent = (_gfVal !== null && !isNaN(_gfVal)) ? _gfVal.toFixed(2) + ' Hz' : '-- Hz';
      gridFreqEl.setAttribute('fill', gridIsActive ? 'rgba(200,220,255,0.75)' : 'rgba(180,190,210,0.35)');
      gridFreqEl.setAttribute('opacity', _show3ph ? '0' : '1');
    }
    // ── 3-phase sub-row (like PV1/PV2) ──
    if (phase3Group) {
      if (_show3ph) {
        phase3Group.removeAttribute('display');
        const _fmtPhase = (w) => {
          const aw = Math.abs(w);
          const sign = w < -10 ? '↑' : w > 10 ? '↓' : '';
          return sign + (aw >= 1000 ? (aw / 1000).toFixed(1) + 'k' : aw.toFixed(0)) + 'W';
        };
        const phA = _n(this._val(this.config.grid_phase_a, true));
        const phB = _n(this._val(this.config.grid_phase_b, true));
        const phC = _n(this._val(this.config.grid_phase_c, true));
        const _phColor = (w) => Math.abs(w) < 10 ? '#4a5568' : w > 10 ? '#ef4444' : '#4ade80';
        const l1El = getEl('fcGridL1Val'); if (l1El) { l1El.textContent = _fmtPhase(phA); l1El.setAttribute('fill', _phColor(phA)); }
        const l2El = getEl('fcGridL2Val'); if (l2El) { l2El.textContent = _fmtPhase(phB); l2El.setAttribute('fill', _phColor(phB)); }
        const l3El = getEl('fcGridL3Val'); if (l3El) { l3El.textContent = _fmtPhase(phC); l3El.setAttribute('fill', _phColor(phC)); }
        // Per-phase voltages
        const _fmtPV = (eid) => {
          if (!eid) return '-- V';
          const s = this._hass?.states[eid];
          if (!s || s.state === 'unavailable' || s.state === 'unknown') return '-- V';
          const v = parseFloat(s.state);
          return isNaN(v) ? '-- V' : v.toFixed(0) + 'V';
        };
        const l1vEl = getEl('fcGridL1VoltVal'); if (l1vEl) l1vEl.textContent = _fmtPV(this.config.grid_phase_a_volt);
        const l2vEl = getEl('fcGridL2VoltVal'); if (l2vEl) l2vEl.textContent = _fmtPV(this.config.grid_phase_b_volt);
        const l3vEl = getEl('fcGridL3VoltVal'); if (l3vEl) l3vEl.textContent = _fmtPV(this.config.grid_phase_c_volt);
      } else {
        phase3Group.setAttribute('display', 'none');
      }
    }

    // ── PV1/PV2 sub-row ──
    const _fmtPvSub = (w) => w >= 1000 ? ' ' + (w / 1000).toFixed(1) + ' kW' : ' ' + w.toFixed(0) + ' W';
    const pv1SubEl = getEl('fcPv1SubVal'); if (pv1SubEl) { pv1SubEl.textContent = _fmtPvSub(pv1); pv1SubEl.setAttribute('fill', pv1 > 10 ? '#e0e8f0' : '#4a5568'); }
    const pv2SubEl = getEl('fcPv2SubVal'); if (pv2SubEl) { pv2SubEl.textContent = _fmtPvSub(pv2); pv2SubEl.setAttribute('fill', pv2 > 10 ? '#e0e8f0' : '#4a5568'); }
    // Update flow label pill border colour
    // pill badge removed

    // PV Voltage tile — per-MPPT voltages
    const _pvVoltFmt = (v) => (v !== null && !isNaN(v) && v > 0) ? ' ' + v.toFixed(1) + ' V' : '-- V';
    const pv1VoltEl = getEl('bPv1Volt');
    const pv2VoltEl = getEl('bPv2Volt');
    if (pv1VoltEl) { const v = this._val(this.config.pv1_voltage || 'sensor.goodwe_pv1_voltage'); pv1VoltEl.textContent = _pvVoltFmt(v); }
    if (pv2VoltEl) { const v = this._val(this.config.pv2_voltage || 'sensor.goodwe_pv2_voltage'); pv2VoltEl.textContent = _pvVoltFmt(v); }
    if (this.config._show_pv_extra) {
      const pv3VoltEl = getEl('bPv3Volt');
      const pv4VoltEl = getEl('bPv4Volt');
      if (pv3VoltEl) { const v = this._val(this.config.pv3_voltage || 'sensor.goodwe_pv3_voltage'); pv3VoltEl.textContent = _pvVoltFmt(v); }
      if (pv4VoltEl) { const v = this._val(this.config.pv4_voltage || 'sensor.goodwe_pv4_voltage'); pv4VoltEl.textContent = _pvVoltFmt(v); }
    }

    // PV generation label below house
    const pvGenBelowEl = getEl('fcPvGenBelowVal');
    if (pvGenBelowEl) {
      pvGenBelowEl.textContent = pvTotal >= 1000 ? (pvTotal / 1000).toFixed(2) + ' kW' : pvTotal.toFixed(0) + ' W';
      pvGenBelowEl.setAttribute('fill', pvTotal > 10 ? '#e0e8f0' : '#4a5568');
    }

    if (this.config._show_pv_extra) {
      setText('pv3FlowVal', pv3 >= 1000 ? (pv3 / 1000).toFixed(2) + ' kW' : pv3.toFixed(0) + ' W');
      setText('pv4FlowVal', pv4 >= 1000 ? (pv4 / 1000).toFixed(2) + ' kW' : pv4.toFixed(0) + ' W');
    }

    // ── Inverter tiles: entity override helper ──
    // If labelsOn AND entity configured → show entity value/state; else → show default calculated value
    const _invTileSet = (elId, defaultText, defaultColor, entityKey) => {
      const el = getEl(elId);
      if (!el) return;
      if (labelsOn && this.config[entityKey]) {
        const s = this._hass?.states[this.config[entityKey]];
        if (!s || s.state === 'unavailable' || s.state === 'unknown') {
          el.textContent = '--'; el.style.color = '#8b949e'; return;
        }
        const v = parseFloat(s.state);
        if (!isNaN(v)) {
          const u = (s.attributes?.unit_of_measurement || '').trim();
          const fmt = _fmtCustom(v, u);
          el.textContent = fmt.text; el.style.color = fmt.color;
        } else {
          // Text state — show as-is
          el.textContent = s.state; el.style.color = '#c9d1d9';
        }
      } else {
        el.textContent = defaultText; el.style.color = defaultColor;
      }
    };

    // Reads a cumulative-energy sensor and returns " <value> <unit>" (unit from
    // the entity's own attribute, default kWh), or "-- kWh" when unavailable.
    const _energyText = (entityId) => {
      const so = entityId && this._hass && this._hass.states[entityId];
      if (!so || so.state === 'unavailable' || so.state === 'unknown') return '-- kWh';
      const val = parseFloat(so.state);
      if (isNaN(val)) return so.state;
      const unit = (so.attributes?.unit_of_measurement || 'kWh').trim();
      return ' ' + val.toFixed(1) + ' ' + unit;
    };
    // TODAY PV — today total + cumulative Total PV (from the dedicated total_pv sensor)
    _invTileSet('invTodayPv', _energyText(this.config.today_pv), '#f4d03f', 'label_entity_today_pv');
    setText('invTotalPv', _energyText(this.config.total_pv));
    // Battery — TODAY charge/discharge (Row 2 tile) + cumulative TOTAL charge/discharge (PV strip)
    _invTileSet('invTodayBattChg', _energyText(this.config.today_batt_chg), '#3fb950', 'label_entity_chg_dis');
    setText('invTodayBattDis', _energyText(this.config.batt_dis));
    setText('invTotalBattChg', _energyText(this.config.total_batt_chg));
    setText('invTotalBattDis', _energyText(this.config.total_batt_dis));
    // TODAY LOAD — today total + cumulative Total Load (from the dedicated total_load sensor)
    _invTileSet('invTodayLoad', _energyText(this.config.today_load), '#29b6f6', 'label_entity_today_load');
    setText('invTotalLoad', _energyText(this.config.total_load_entity));
    // Grid Import — main value + grid export
    const _gridImportEntityId = this.config.grid_import_today || 'sensor.goodwe_today_energy_import';
    const _gridImportStateObj = this._hass && this._hass.states[_gridImportEntityId];
    let _gridImportText = '-- kWh';
    if (_gridImportStateObj && _gridImportStateObj.state !== 'unavailable' && _gridImportStateObj.state !== 'unknown') {
      const _giv = parseFloat(_gridImportStateObj.state);
      const _giu = (_gridImportStateObj.attributes?.unit_of_measurement || 'kWh').trim();
      _gridImportText = isNaN(_giv) ? _gridImportStateObj.state : ' ' + _giv.toFixed(1) + ' ' + _giu;
    }
    _invTileSet('invGridImport', _gridImportText, '#f39c4b', 'label_entity_grid_import');
    const _gridExportEntityId = this.config.grid_export_today || '';
    const _gridExportStateObj = _gridExportEntityId && this._hass && this._hass.states[_gridExportEntityId];
    let _gridExportText = '-- kWh';
    if (_gridExportStateObj && _gridExportStateObj.state !== 'unavailable' && _gridExportStateObj.state !== 'unknown') {
      const _gev = parseFloat(_gridExportStateObj.state);
      const _geu = (_gridExportStateObj.attributes?.unit_of_measurement || 'kWh').trim();
      _gridExportText = isNaN(_gev) ? _gridExportStateObj.state : ' ' + _gev.toFixed(1) + ' ' + _geu;
    }
    setText('invGridExport', _gridExportText);
    // ── Remaining Ah + kWh ──
    // Each battery uses its OWN Ah capacity; battery2_full_ah defaults to fullAh if not set
    const fullAh2 = capUnit === 'ah'
      ? (Number(this.config.battery2_full_ah) > 0 ? Number(this.config.battery2_full_ah) : fullAh)
      : 0;
    const remCap2 = fullAh2 > 0 ? (battSoc2 / 100) * fullAh2 : 0;
    const totalRemAh = fullAh > 0 ? remCap1 + (dual ? remCap2 : 0) : null;
    // kWh remaining: always SOC-based from configured capacity � never voltage-dependent
    const totalRemKwh = fullWh > 0
      ? ((battSoc1 / 100) * fullWh + (dual ? (battSoc2 / 100) * fullWh2 : 0)) / 1000
      : null;
    const invRemCapEl = getEl('invRemCap');
    const invRemKwhEl = getEl('invRemKwh');
    const remColor = this._remCapColor(battSoc1);
    if (capUnit === 'ah') {
      // Ah mode: integer, no decimal, left-padded with plain spaces to 3 chars wide
      if (invRemCapEl) {
        const ahInt = totalRemAh !== null ? Math.round(totalRemAh) : null;
        invRemCapEl.textContent = ahInt !== null ? String(ahInt).padStart(3, ' ') + ' Ah' : '-- Ah';
        invRemCapEl.style.color = remColor;
        invRemCapEl.style.display = '';
        invRemCapEl.style.fontVariantNumeric = 'tabular-nums';
      }
      if (invRemKwhEl) invRemKwhEl.style.display = 'none';
    } else {
      // kWh mode: always 2 decimal places, e.g. "15.92 kWh"
      if (invRemCapEl) invRemCapEl.style.display = 'none';
      if (invRemKwhEl) {
        invRemKwhEl.textContent = totalRemKwh !== null ? totalRemKwh.toFixed(2) + ' kWh' : '-- kWh';
        invRemKwhEl.style.color = remColor;
        invRemKwhEl.style.display = '';
      }
    }

    // ── Label entity overrides for stat tiles ──
    // Per-row: override active only when global gate ON AND label text ≠ its default
    const _rowActive = (labelKey, def) => labelsOn && (this.config[labelKey] || def) !== def;

    // Read value from a custom entity key.
    // Returns {val: number, text: string, isText: false} for numeric entities.
    // Returns {val: null, text: stateString, isText: true} for text-state entities (e.g. "idle", "charging").
    // Returns null when entity is unavailable/unknown/missing.
    const _readVal = (entityKey) => {
      const eid = this.config[entityKey];
      if (!eid) return null;
      const s = this._hass && this._hass.states[eid];
      if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
      const v = parseFloat(s.state);
      if (!isNaN(v)) return { val: v, text: null, isText: false };
      // Non-numeric state (e.g. "idle", "charging", "on grid backup mode")
      return { val: null, text: String(s.state), isText: true };
    };
    // Read the HA unit_of_measurement for a custom entity key.
    const _readUnit = (entityKey) =>
      this._hass?.states[this.config[entityKey]]?.attributes?.unit_of_measurement || '';

    // Smart value formatter: respects the entity's own unit.
    //   W / kW  → auto-range to kW at ≥1000 W
    //   V       → 3 decimal places
    //   °C / °F → 1 decimal place
    //   %       → 1 decimal place
    //   kWh / Wh / MWh → 2 decimal places
    //   anything else  → 2 decimal places
    // Also returns a colour appropriate for the unit.
    const _fmtCustom = (val, unit) => {
      const u = (unit || '').trim();
      let text, color;
      if (u === 'W') {
        if (Math.abs(val) >= 1000) { text = (val / 1000).toFixed(2) + ' kW'; }
        else                        { text = val.toFixed(0) + ' W'; }
        color = '#58a6ff';
      } else if (u === 'kW') {
        text = val.toFixed(2) + ' kW';
        color = '#58a6ff';
      } else if (u === 'V') {
        text = val.toFixed(2) + ' V';
        color = this._cellVoltColor(val);
      } else if (u === '°C' || u === '°F' || u === 'C' || u === 'F') {
        text = val.toFixed(1) + ' ' + (u.startsWith('°') ? u : '°' + u);
        color = this._cellTempColor(val);
      } else if (u === '%') {
        text = val.toFixed(1) + ' %';
        color = this._socColor(val);
      } else if (u === 'kWh' || u === 'Wh' || u === 'MWh') {
        text = val.toFixed(2) + ' ' + u;
        color = '#f4d03f';
      } else if (u === 'A') {
        text = val.toFixed(1) + ' A';
        color = '#cde';
      } else {
        // Unknown unit � show value + unit as-is
        text = val.toFixed(2) + (u ? ' ' + u : '');
        color = '#cde';
      }
      return { text, color };
    };

    // Cell temp tile
    const cellTempCustom = _rowActive('label_cell_temp_minmax', 'CELL TEMP') && this.config.label_entity_cell_temp;
    const _cellTempRaw = cellTempCustom ? _readVal('label_entity_cell_temp') : null;
    const cellTempUnit = cellTempCustom ? _readUnit('label_entity_cell_temp') : '°C';

    // BMS temp tile
    const bmsTempCustom = _rowActive('label_bms_temp', 'BMS TEMP') && this.config.label_entity_bms_temp;
    const _bmsTempRaw = bmsTempCustom ? _readVal('label_entity_bms_temp') : null;
    const bmsTempUnit = bmsTempCustom ? _readUnit('label_entity_bms_temp') : '°C';

    // Cell Volt tile (combined MIN+MAX) — custom entity overrides both sub-values
    const cellVoltCustom = _rowActive('label_cell_volt', 'CELL VOLT') && this.config.label_entity_cell_volt;
    const _cellVoltRaw   = cellVoltCustom ? _readVal('label_entity_cell_volt') : null;
    const cellVoltUnit   = cellVoltCustom ? _readUnit('label_entity_cell_volt') : 'V';
    // Keep minCell/maxCell aliases for the split-render path
    const minCellCustom = cellVoltCustom;
    const _minCellRaw   = _cellVoltRaw;
    const minCellUnit   = cellVoltUnit;
    const maxCellCustom = cellVoltCustom;
    const _maxCellRaw   = _cellVoltRaw;
    const maxCellUnit   = cellVoltUnit;

    // PV Voltage tile entity override
    const pvVoltCustom = _rowActive('label_pv_voltage', 'PV VOLTAGE') && this.config.label_entity_pv_voltage;
    const _pvVoltRaw   = pvVoltCustom ? _readVal('label_entity_pv_voltage') : null;
    const pvVoltUnit   = pvVoltCustom ? _readUnit('label_entity_pv_voltage') : 'V';

    // Remaining tile entity override
    const remainCustom = _rowActive('label_remaining', 'REMAINING') && this.config.label_entity_remaining;
    const _remainRaw   = remainCustom ? _readVal('label_entity_remaining') : null;
    const remainUnit   = remainCustom ? _readUnit('label_entity_remaining') : '';

    // ── Apply overrides to stat tiles ──
    // Helper: apply configured font size to a tile label/value element
    const _applyTileSize = (el, sizeKey) => {
      if (!el) return;
      const sz = Number(this.config[sizeKey]);
      el.style.fontSize = sz > 0 ? sz + 'rem' : '';
    };

    const _bT1o = getEl('bTemp1');
    const _bT1b = getEl('bTemp1b'); // T2 sub-slot in split tile
    if (_bT1o) {
      const _tempColor = (v) => v >= THR.tempCrit ? '#ef4444' : v >= THR.tempWarn ? '#f59e0b' : '#e0e8f0';
      const t1u = _unitOf(this.config.battery_temp1, '°C');
      const t2u = _unitOf(this.config.battery_temp2, '°C');
      if (cellTempCustom) {
        if (!_cellTempRaw) {
          _bT1o.textContent = _ft(temp1_1, t1u);
          _bT1o.style.color = _tempColor(_tc(temp1_1, t1u));
          if (_bT1b) { _bT1b.textContent = _ft(temp2_1, t2u); _bT1b.style.color = _tempColor(_tc(temp2_1, t2u)); }
        }
        else if (_cellTempRaw.isText) {
          _bT1o.textContent = _cellTempRaw.text; _bT1o.style.color = '#c9d1d9';
          if (_bT1b) { _bT1b.textContent = '--'; _bT1b.style.color = '#c9d1d9'; }
        }
        else {
          let correctedVal = _cellTempRaw.val;
          if ((cellTempUnit === '°C' || cellTempUnit === 'C') && correctedVal < 10 && correctedVal > 0) correctedVal *= 10;
          const fmt = _fmtCustom(correctedVal, cellTempUnit);
          _bT1o.textContent = fmt.text; _bT1o.style.color = fmt.color;
          if (_bT1b) { _bT1b.textContent = _ft(temp2_1, t2u); _bT1b.style.color = _tempColor(_tc(temp2_1, t2u)); }
        }
      } else {
        _bT1o.textContent = _ft(temp1_1, t1u);
        _bT1o.style.color = _tempColor(_tc(temp1_1, t1u));
        if (_bT1b) { _bT1b.textContent = _ft(temp2_1, t2u); _bT1b.style.color = _tempColor(_tc(temp2_1, t2u)); }
      }
      _applyTileSize(_bT1o, 'val_cell_temp_size');
      if (_bT1b) _applyTileSize(_bT1b, 'val_cell_temp_size');
      _applyTileSize(_bT1o.closest('.st')?.querySelector('.l'), 'label_cell_temp_size');
    }
    const _bT2o = getEl('bTemp2');
    if (_bT2o) {
      const mosu = _unitOf(this.config.battery_mos, '°C');
      const mos2u = _unitOf(this.config.battery2_mos, '°C');
      if (bmsTempCustom) {
        if (!_bmsTempRaw) {
          _bT2o.textContent = _ft(mos1, mosu) + (dual ? ' / ' + _ft(mos2, mos2u) : '');
          const _t2val = dual ? Math.max(_tc(mos1, mosu), _tc(mos2, mos2u)) : _tc(mos1, mosu);
          _bT2o.style.color = _t2val >= THR.tempCrit ? '#ef4444' : _t2val >= THR.tempWarn ? '#f59e0b' : '#e0e8f0';
        }
        else if (_bmsTempRaw.isText) { _bT2o.textContent = _bmsTempRaw.text; _bT2o.style.color = '#c9d1d9'; }
        else { const fmt = _fmtCustom(_bmsTempRaw.val, bmsTempUnit); _bT2o.textContent = fmt.text; _bT2o.style.color = fmt.color; }
      } else {
        _bT2o.textContent = _ft(mos1, mosu) + (dual ? ' / ' + _ft(mos2, mos2u) : '');
        const _t2val = dual ? Math.max(_tc(mos1, mosu), _tc(mos2, mos2u)) : _tc(mos1, mosu);
        _bT2o.style.color = _t2val >= THR.tempCrit ? '#ef4444' : _t2val >= THR.tempWarn ? '#f59e0b' : '#e0e8f0';
      }
      _applyTileSize(_bT2o, 'val_bms_temp_size');
      _applyTileSize(_bT2o.closest('.st')?.querySelector('.l'), 'label_bms_temp_size');
    }
    const _bMno = getEl('bMinCell');
    if (_bMno) {
      if (minCellCustom) {
        if (!_minCellRaw) {
          _bMno.textContent = minCell1.toFixed(2) + ' V';
          _bMno.style.color = (minCell1 < THR.cellVCrit || minCell1 > THR.cellVHigh) ? '#ef4444' : minCell1 < THR.cellVLow ? '#f59e0b' : '#e0e8f0';
        }
        else if (_minCellRaw.isText) { _bMno.textContent = _minCellRaw.text; _bMno.style.color = '#c9d1d9'; }
        else { const fmt = _fmtCustom(_minCellRaw.val, minCellUnit); _bMno.textContent = fmt.text; _bMno.style.color = fmt.color; }
      } else {
        _bMno.textContent = minCell1.toFixed(2) + ' V';
        _bMno.style.color = (minCell1 < THR.cellVCrit || minCell1 > THR.cellVHigh) ? '#ef4444' : minCell1 < THR.cellVLow ? '#f59e0b' : '#e0e8f0';
      }
      _applyTileSize(_bMno, 'val_cell_volt_size');
      _applyTileSize(_bMno.closest('.st')?.querySelector('.l'), 'label_cell_volt_size');
    }
    const _bMxo = getEl('bMaxCell');
    if (_bMxo) {
      if (maxCellCustom) {
        if (!_maxCellRaw) {
          _bMxo.textContent = maxCell1.toFixed(2) + ' V';
          _bMxo.style.color = (maxCell1 < THR.cellVCrit || maxCell1 > THR.cellVHigh) ? '#ef4444' : maxCell1 < THR.cellVLow ? '#f59e0b' : '#e0e8f0';
        }
        else if (_maxCellRaw.isText) { _bMxo.textContent = _maxCellRaw.text; _bMxo.style.color = '#c9d1d9'; }
        else { const fmt = _fmtCustom(_maxCellRaw.val, maxCellUnit); _bMxo.textContent = fmt.text; _bMxo.style.color = fmt.color; }
      } else {
        _bMxo.textContent = maxCell1.toFixed(2) + ' V';
        _bMxo.style.color = (maxCell1 < THR.cellVCrit || maxCell1 > THR.cellVHigh) ? '#ef4444' : maxCell1 < THR.cellVLow ? '#f59e0b' : '#e0e8f0';
      }
      _applyTileSize(_bMxo, 'val_cell_volt_size');
      _applyTileSize(_bMxo.closest('.st')?.querySelector('.l'), 'label_cell_volt_size');
    }

    // ── PV Voltage tile override ──
    // Default: shows per-MPPT voltages from pv1_voltage/pv2_voltage sensors.
    // Override: when label renamed + entity picked, shows that single entity value instead.
    const _pvVoltTileEl = getEl('bPv1Volt');
    const _pvVoltTileLbl = _pvVoltTileEl?.closest('.st')?.querySelector('.l');
    if (pvVoltCustom && _pvVoltTileEl) {
      if (!_pvVoltRaw) {
        // entity unavailable — fall back to default multi-MPPT display (already written above)
      } else if (_pvVoltRaw.isText) {
        _pvVoltTileEl.textContent = _pvVoltRaw.text;
        _pvVoltTileEl.style.color = '#c9d1d9';
        const pv2El = getEl('bPv2Volt'); if (pv2El) pv2El.textContent = '';
      } else {
        const fmt = _fmtCustom(_pvVoltRaw.val, pvVoltUnit);
        _pvVoltTileEl.textContent = fmt.text;
        _pvVoltTileEl.style.color = fmt.color;
        const pv2El = getEl('bPv2Volt'); if (pv2El) pv2El.textContent = '';
      }
      if (_pvVoltTileLbl) _pvVoltTileLbl.textContent = this.config.label_pv_voltage || 'PV VOLTAGE';
    }

    // ── Remaining tile override ──
    // Default: calculated from SOC × capacity (Ah or kWh mode).
    // Override: when label renamed + entity picked, shows that entity value directly.
    const _remEl  = capUnit === 'ah' ? getEl('invRemCap') : getEl('invRemKwh');
    if (remainCustom && _remEl) {
      if (!_remainRaw) {
        // entity unavailable — fall back to default calculated display (already written above)
      } else if (_remainRaw.isText) {
        _remEl.textContent = _remainRaw.text;
        _remEl.style.color = '#c9d1d9';
        _remEl.style.display = '';
        const otherEl = capUnit === 'ah' ? getEl('invRemKwh') : getEl('invRemCap');
        if (otherEl) otherEl.style.display = 'none';
      } else {
        const fmt = _fmtCustom(_remainRaw.val, remainUnit);
        _remEl.textContent = fmt.text;
        _remEl.style.color = fmt.color;
        _remEl.style.display = '';
        const otherEl = capUnit === 'ah' ? getEl('invRemKwh') : getEl('invRemCap');
        if (otherEl) otherEl.style.display = 'none';
      }
    }
    // ── HTML stat tile — endurance ──
    const _tillStr = this._fmtTill(endHours);
    const _bEnduStat = getEl('bEnduranceStat');
    if (_bEnduStat) {
      _bEnduStat.textContent = endText;
      _bEnduStat.style.color = endColor;
      _applyTileSize(_bEnduStat, 'val_endurance_size');
    }
    const _bEnduStatLbl = getEl('bEnduStatLbl');
    const _bEnduPwrEl = getEl('bEndurancePower');
    if (_bEnduStatLbl) {
      if (isCharging1) {
        _bEnduStatLbl.textContent = 'Will be Charged';
        if (_bEnduPwrEl) _bEnduPwrEl.textContent = '@ ' + battPwr1.toFixed(0) + ' W';
      } else if (battPwr1 < -10) {
        _bEnduStatLbl.textContent = 'Will be Discharged';
        if (_bEnduPwrEl) _bEnduPwrEl.textContent = '@ ' + Math.abs(battPwr1).toFixed(0) + ' W';
      } else {
        _bEnduStatLbl.textContent = this.config.label_endurance || 'ENDURANCE';
        if (_bEnduPwrEl) _bEnduPwrEl.textContent = '';
      }
      _applyTileSize(_bEnduStatLbl, 'label_endurance_size');
    }
    const _bEnduTimeEl = getEl('bEnduranceTime');
    if (_bEnduTimeEl) { _bEnduTimeEl.textContent = _tillStr; _bEnduTimeEl.style.color = endHours !== null ? endColor : '#8b949e'; }
    // ── Inverter & remaining tile font sizes ──
    const _invGridEl = getEl('invGridImport');
    if (_invGridEl) {
      _applyTileSize(_invGridEl, 'val_grid_import_size');
      _applyTileSize(_invGridEl.closest('.pvi')?.querySelector('.lbl'), 'label_grid_import_size');
    }
    const _invTodayPvEl = getEl('invTodayPv');
    if (_invTodayPvEl) {
      _applyTileSize(_invTodayPvEl, 'val_today_pv_size');
      _applyTileSize(_invTodayPvEl.closest('.pvi')?.querySelector('.lbl'), 'label_today_pv_size');
    }
    const _invChgEl = getEl('invTodayBattChg');
    if (_invChgEl) {
      _applyTileSize(_invChgEl, 'val_chg_dis_size');
      _applyTileSize(_invChgEl.closest('.pvi')?.querySelector('.lbl'), 'label_chg_dis_size');
    }
    const _invLoadEl = getEl('invTodayLoad');
    if (_invLoadEl) {
      _applyTileSize(_invLoadEl, 'val_today_load_size');
      _applyTileSize(_invLoadEl.closest('.st')?.querySelector('.l'), 'label_today_load_size');
    }
    const _invRemCapEl2 = getEl('invRemCap');
    const _invRemKwhEl2 = getEl('invRemKwh');
    if (_invRemCapEl2) {
      _applyTileSize(_invRemCapEl2, 'val_remaining_size');
      _applyTileSize(_invRemCapEl2.closest('.st')?.querySelector('.l'), 'label_remaining_size');
    }
    if (_invRemKwhEl2) {
      _applyTileSize(_invRemKwhEl2, 'val_remaining_size');
    }

    // pvBlocks: update each segment directly — no innerHTML wipe, no flicker
    const pvBlocksKey = pvTotal + '|' + pvMax;
    if (pvBlocksKey !== this._prevPvBlocksKey) {
      this._prevPvBlocksKey = pvBlocksKey;
      const N = 17, max = Math.max(pvMax, 1);
      const lit = Math.min(N, Math.max(0, Math.round((pvTotal / max) * N)));
      const offCol = 'rgba(255,255,255,0.07)';
      const onCol = lit <= 0 ? offCol : lit <= 7 ? '#3fb950' : lit <= 13 ? '#29b6f6' : '#ffe83c';
      for (let _i = 0; _i < N; _i++) {
        const seg = getEl('pvSeg' + _i);
        if (seg) seg.style.background = _i < lit ? onCol : offCol;
      }
    }

    // EV
    const evGroup = getEl('evGroup');
    if (evGroup) {
      if (!this.config._show_ev) {
        evGroup.style.display = 'none';
        // Fix #12: removed early return here � was silently skipping any code added after this block
      } else {
        evGroup.style.display = '';
      const isChargingEV = chargerStateStr === 'charging'
                        || chargerStateStr === 'active'
                        || chargerStateStr === 'occupied'
                        || chargerStateStr.includes('charg');
      const isCompleted = chargerStateStr === 'completed'
                       || chargerStateStr === 'finished'
                       || chargerStateStr === 'complete'
                       || chargerStateStr === 'full';
      const evFlow = getEl('flowHomeEV');
      if (evFlow) {
        if (isChargingEV) {
          evFlow.setAttribute('opacity', '0.9'); evFlow.setAttribute('stroke', '#00aaff');
        } else if (isCompleted) {
          evFlow.setAttribute('opacity', '0');
        } else {
          evFlow.setAttribute('opacity', '0');
        }
      }
      if (isChargingEV || isCompleted) {
        setText('evPowerVal', chargerPower.toFixed(0) + ' W');
        setText('evCurrentVal', chargerCurrent.toFixed(1) + ' A');
        setText('evSocVal', chargerSoc.toFixed(0) + ' %');
        let evEta = '--';
        if (isChargingEV) {
          if (chargerEtaSensor !== null && !isNaN(chargerEtaSensor)) evEta = this._fmtTime(chargerEtaSensor / 60);
          else if (chargerBattCapWh && chargerSoc > 0 && chargerPower > 0) {
            const remainingWh = chargerBattCapWh * (100 - chargerSoc) / 100;
            const hours = remainingWh / chargerPower;
            evEta = this._fmtTime(hours);
          }
        } else if (isCompleted) {
          evEta = 'Full';
        }
        setText('evEtaVal', evEta);
      } else {
        setText('evPowerVal', '-- W');
        setText('evCurrentVal', '-- A');
        setText('evSocVal', '-- %');
        setText('evEtaVal', '--');
      }
      } // end else (_show_ev)
    }

    // ── Extra Tiles dynamic update ──
    for (let i = 1; i <= 6; i++) {
      if (!this.config[`_extra_tile_${i}_enabled`]) continue;
      const el = getEl(`bExtraTile${i}`);
      if (!el) continue;
      const entityId = this.config[`_extra_tile_${i}_entity`];
      if (!entityId) { el.textContent = '--'; el.style.color = '#ffffff'; continue; }
      const stateObj = this._hass?.states?.[entityId];
      if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
        el.textContent = '--'; el.style.color = '#ffffff'; continue;
      }
      const rawVal = parseFloat(stateObj.state);
      if (isNaN(rawVal)) {
        // Text state — show as-is, white
        el.textContent = stateObj.state;
        el.style.color = '#ffffff';
      } else {
        const unit = (stateObj.attributes?.unit_of_measurement || '').trim();
        // Always 1 decimal for numeric; always white
        el.textContent = ' ' + rawVal.toFixed(1) + (unit ? ' ' + unit : '');
        el.style.color = '#ffffff';
      }
    }

    // ── Monitoring section: attach click listeners once ──
    if (!this._monListenersAttached) {
      this._monListenersAttached = true;
      const tiles = root.querySelectorAll('.mon-tile');
      tiles.forEach(el => {
        const popup = el.getAttribute('data-popup');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          switch (popup) {
            case 'camera':   this._openCameraPopup(); break;
            case 'system':   this._openSystemPopup(); break;
            case 'inverter': this._openInverterPopup(); break;
            case 'battery':  this._openBatteryPopup(); break;
            case 'plugs':    this._openSmartPlugPopup(); break;
            case 'climate':  this._openClimatePopup(); break;
            case 'rooms':    this._openRoomsPopup(); break;
            case 'fridge':   this._openFridgePopup(); break;
          }
        });
      });
    }
    // Refresh climate name label
    const climLbl = getEl('monClimLabel');
    if (climLbl) climLbl.textContent = this.config.clim_ac_name || 'CLIMATE';
    // Refresh fridge name label
    const fridgeLbl = getEl('monFridgeLabel');
    if (fridgeLbl) fridgeLbl.textContent = this.config.fridge_name || 'FRIDGE';
    // Row2 visibility
    const monRow2 = getEl('monRow2');
    if (monRow2) monRow2.style.display = (!!this.config._show_smartplugs || !!this.config._show_climate || !!this.config._show_rooms || !!this.config._show_fridge) ? '' : 'none';
  }
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'zee-skycard',
  name: 'Zee SkyCard',
  description: 'Real-time solar/battery/grid energy flow card. indcolor system: threshold-driven colors (amber/red). Per-tile font sizes. Typography & threshold config. Load display below house.',
  preview: true,
  version: '2.9.6',
});
customElements.define('zee-skycard', ZeeSkyCard);