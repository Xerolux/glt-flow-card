/* GLT Flow Card Platform 1.0 component and visual catalog */

export const VISUAL_STYLES = [
  { id: "neo2030", label: "Neo 2030" },
  { id: "clean", label: "Clean" },
  { id: "classic_scada", label: "Classic SCADA" },
  { id: "standard_2d", label: "Standard 2D" },
  { id: "operations_light", label: "Operations Light" },
  { id: "pid_dark", label: "P&ID Dark" },
];

const P = (id, label, category, type, ports = [], slots = [], controls = []) => ({
  id, label, category, type, ports, slots, controls,
});
const port = (id, medium, side, direction = "bidirectional") => ({ id, medium, side, direction });
const slot = (id, label, domains = ["sensor"], unit = null) => ({ id, label, domains, unit });
const control = (id, label, command, domains = []) => ({ id, label, command, domains });

export const COMPONENT_PROFILES = [
  P("heat_pump", "Wärmepumpe", "Heizung", "heat_pump",
    [port("source_in", "source", "left", "in"), port("source_out", "source", "left", "out"), port("supply", "heating_supply", "right", "out"), port("return", "heating_return", "right", "in")],
    [slot("flow_temp", "Vorlauf", ["sensor"], "°C"), slot("return_temp", "Rücklauf", ["sensor"], "°C"), slot("power", "Leistung", ["sensor"], "kW"), slot("cop", "COP", ["sensor"]), slot("operating_hours", "Betriebsstunden", ["sensor"], "h")],
    [control("enable", "Freigabe", "toggle", ["switch", "input_boolean"]), control("mode", "Betriebsart", "select", ["select", "climate"]) ]),
  P("pump", "Pumpe", "Hydraulik", "pump",
    [port("in", "hydronic", "left", "in"), port("out", "hydronic", "right", "out")],
    [slot("speed", "Drehzahl", ["sensor", "number"], "%"), slot("power", "Leistung", ["sensor"], "W"), slot("hours", "Betriebsstunden", ["sensor"], "h"), slot("starts", "Starts", ["sensor"])],
    [control("run", "Ein/Aus", "toggle", ["switch", "fan"]), control("speed", "Drehzahl", "number", ["number", "fan"])]),
  P("valve", "Ventil", "Hydraulik", "valve",
    [port("in", "hydronic", "left", "in"), port("out", "hydronic", "right", "out")],
    [slot("position", "Stellung", ["sensor", "number", "cover"], "%"), slot("feedback", "Rückmeldung", ["binary_sensor", "sensor"])],
    [control("position", "Stellung", "number", ["number", "cover"]), control("open_close", "Öffnen/Schließen", "toggle", ["switch", "cover"])]),
  P("mixing_valve", "3-Wege-Mischer", "Hydraulik", "valve",
    [port("hot", "heating_supply", "left", "in"), port("return", "heating_return", "bottom", "in"), port("mixed", "heating_supply", "right", "out")],
    [slot("position", "Stellung", ["sensor", "number"], "%"), slot("setpoint", "Soll VL", ["sensor", "number"], "°C"), slot("actual", "Ist VL", ["sensor"], "°C")],
    [control("position", "Stellung", "number", ["number"])]),
  P("tank", "Speicher", "Heizung", "tank",
    [port("top", "heating_supply", "right", "out"), port("bottom", "heating_return", "right", "in")],
    [slot("top_temp", "Oben", ["sensor"], "°C"), slot("middle_temp", "Mitte", ["sensor"], "°C"), slot("bottom_temp", "Unten", ["sensor"], "°C")]),
  P("dhw_tank", "Warmwasserspeicher", "Heizung", "tank",
    [port("charge_in", "dhw", "left", "in"), port("charge_out", "dhw", "left", "out"), port("dhw_out", "dhw", "right", "out"), port("cold_in", "cold_water", "bottom", "in")],
    [slot("temperature", "Warmwasser", ["sensor"], "°C"), slot("setpoint", "Soll", ["number", "sensor"], "°C")],
    [control("setpoint", "Solltemperatur", "number", ["number", "water_heater"])]),
  P("boiler", "Heizkessel", "Heizung", "boiler",
    [port("supply", "heating_supply", "right", "out"), port("return", "heating_return", "left", "in")],
    [slot("flow_temp", "Vorlauf", ["sensor"], "°C"), slot("power", "Leistung", ["sensor"], "kW"), slot("hours", "Betriebsstunden", ["sensor"], "h")],
    [control("enable", "Freigabe", "toggle", ["switch"])]),
  P("heat_exchanger", "Wärmetauscher", "Hydraulik", "heat_exchanger",
    [port("primary_in", "primary", "left", "in"), port("primary_out", "primary", "left", "out"), port("secondary_in", "secondary", "right", "in"), port("secondary_out", "secondary", "right", "out")],
    [slot("primary_in_temp", "Primär Ein", ["sensor"], "°C"), slot("primary_out_temp", "Primär Aus", ["sensor"], "°C"), slot("secondary_in_temp", "Sekundär Ein", ["sensor"], "°C"), slot("secondary_out_temp", "Sekundär Aus", ["sensor"], "°C")]),
  P("ahu", "RLT-Zentrale", "RLT", "ahu",
    [port("outdoor", "air_outdoor", "left", "in"), port("supply", "air_supply", "right", "out"), port("extract", "air_extract", "right", "in"), port("exhaust", "air_exhaust", "left", "out")],
    [slot("supply_temp", "Zuluft", ["sensor"], "°C"), slot("extract_temp", "Abluft", ["sensor"], "°C"), slot("supply_flow", "Zuluftmenge", ["sensor"], "m³/h"), slot("extract_flow", "Abluftmenge", ["sensor"], "m³/h"), slot("co2", "CO₂", ["sensor"], "ppm")],
    [control("enable", "Freigabe", "toggle", ["switch", "fan"]), control("mode", "Betriebsart", "select", ["select"])]),
  P("fan", "Ventilator", "RLT", "fan",
    [port("in", "air", "left", "in"), port("out", "air", "right", "out")],
    [slot("speed", "Drehzahl", ["sensor", "number", "fan"], "%"), slot("flow", "Luftmenge", ["sensor"], "m³/h"), slot("pressure", "Druck", ["sensor"], "Pa")],
    [control("run", "Ein/Aus", "toggle", ["fan", "switch"]), control("speed", "Drehzahl", "number", ["fan", "number"])]),
  P("damper", "Luftklappe", "RLT", "valve",
    [port("in", "air", "left", "in"), port("out", "air", "right", "out")],
    [slot("position", "Stellung", ["sensor", "number", "cover"], "%")],
    [control("position", "Stellung", "number", ["number", "cover"])]),
  P("chiller", "Kältemaschine", "Kälte", "heat_pump",
    [port("supply", "cooling_supply", "right", "out"), port("return", "cooling_return", "right", "in"), port("condenser_in", "condenser", "left", "in"), port("condenser_out", "condenser", "left", "out")],
    [slot("supply_temp", "Kälte VL", ["sensor"], "°C"), slot("return_temp", "Kälte RL", ["sensor"], "°C"), slot("power", "Leistung", ["sensor"], "kW")],
    [control("enable", "Freigabe", "toggle", ["switch"])]),
  P("meter", "Zähler", "Energie", "meter", [], [slot("value", "Zählerstand", ["sensor"]), slot("power", "Leistung", ["sensor"]) ]),
  P("room", "Raum / Zone", "Gebäude", "room", [], [slot("temperature", "Raumtemperatur", ["sensor", "climate"], "°C"), slot("humidity", "Feuchte", ["sensor"], "%"), slot("co2", "CO₂", ["sensor"], "ppm"), slot("setpoint", "Sollwert", ["climate", "number"], "°C")], [control("setpoint", "Sollwert", "number", ["climate", "number"])]),
  P("generic", "Allgemeines Aggregat", "Allgemein", "generic", [port("left", "neutral", "left"), port("right", "neutral", "right")], [slot("value", "Wert", ["sensor"])])
];

export const BASE_SYMBOLS = [
  ["heat_pump_neo","Wärmepumpe Neo","Heizung","heat_pump"],["heat_pump_compact","Wärmepumpe Kompakt","Heizung","heat_pump"],["boiler","Heizkessel","Heizung","boiler"],["burner","Brenner","Heizung","generic"],["immersion_heater","Heizstab","Heizung","generic"],["buffer_layered","Schichtspeicher","Heizung","tank"],["dhw_tank","Warmwasserspeicher","Heizung","dhw_tank"],["underfloor","Fußbodenheizung","Heizung","room"],["radiator","Heizkörper","Heizung","room"],
  ["pump_inline","Pumpe Inline","Hydraulik","pump"],["pump_variable","Pumpe FU","Hydraulik","pump"],["pump_twin","Doppelpumpe","Hydraulik","pump"],["pump_dhw","Zirkulationspumpe","Hydraulik","pump"],["valve_2way","2-Wege-Ventil","Hydraulik","valve"],["valve_3way","3-Wege-Ventil","Hydraulik","valve"],["mixing_valve","3-Wege-Mischer","Hydraulik","mixing_valve"],["shutoff_valve","Absperrventil","Hydraulik","valve"],["check_valve","Rückschlagventil","Hydraulik","valve"],["safety_valve","Sicherheitsventil","Hydraulik","valve"],["balancing_valve","Strangregulierventil","Hydraulik","valve"],["hydraulic_separator","Hydraulische Weiche","Hydraulik","heat_exchanger"],["heat_exchanger_plate","Plattenwärmetauscher","Hydraulik","heat_exchanger"],["manifold","Verteiler / Sammler","Hydraulik","generic"],["filter_water","Schmutzfänger","Hydraulik","generic"],["dirt_separator","Schlammabscheider","Hydraulik","generic"],["expansion_vessel","Ausdehnungsgefäß","Hydraulik","tank"],
  ["ahu","RLT-Zentrale","RLT","ahu"],["fan_supply","Zuluftventilator","RLT","fan"],["fan_extract","Abluftventilator","RLT","fan"],["damper","Luftklappe","RLT","damper"],["fire_damper","Brandschutzklappe","RLT","damper"],["air_filter","Luftfilter","RLT","generic"],["heating_coil","Heizregister","RLT","heat_exchanger"],["cooling_coil","Kühlregister","RLT","heat_exchanger"],["heat_recovery_rotary","Rotations-WRG","RLT","heat_exchanger"],["heat_recovery_plate","Platten-WRG","RLT","heat_exchanger"],["humidifier","Befeuchter","RLT","generic"],["silencer","Schalldämpfer","RLT","generic"],
  ["chiller","Kältemaschine","Kälte","chiller"],["compressor","Verdichter","Kälte","generic"],["cooling_tower","Kühlturm","Kälte","generic"],["cooling_buffer","Kältepuffer","Kälte","tank"],
  ["pv_array","PV-Feld","Energie","generic"],["inverter","Wechselrichter","Energie","generic"],["battery","Batteriespeicher","Energie","generic"],["grid","Stromnetz","Energie","generic"],["meter","Energiezähler","Energie","meter"],["wallbox","Wallbox","Energie","generic"],
  ["temp_sensor","Temperaturfühler","Sensorik","meter"],["pressure_sensor","Drucksensor","Sensorik","meter"],["dp_sensor","Differenzdrucksensor","Sensorik","meter"],["flow_sensor","Volumenstromsensor","Sensorik","meter"],["humidity_sensor","Feuchtefühler","Sensorik","meter"],["co2_sensor","CO₂-Sensor","Sensorik","meter"],["frost_thermostat","Frostschutzthermostat","Sensorik","meter"],["room_sensor","Raumsensor","Sensorik","room"]
].map(([id,label,category,profile])=>({id,label,category,profile}));

export const SYMBOL_VARIANTS = BASE_SYMBOLS.flatMap((base) => VISUAL_STYLES.map((style) => ({
  id: `${base.id}@${style.id}`,
  base_symbol: base.id,
  label: `${base.label} · ${style.label}`,
  category: base.category,
  profile: base.profile,
  style: style.id,
})));

export function profileById(id) {
  return COMPONENT_PROFILES.find((p) => p.id === id) || COMPONENT_PROFILES.find((p) => p.id === "generic");
}

export function profileForEquipment(item = {}) {
  const base = String(item.symbol_variant || item.symbol || "").split("@")[0];
  const symbol = BASE_SYMBOLS.find((s) => s.id === base);
  return profileById(item.profile || symbol?.profile || item.type || "generic");
}

export function portsForEquipment(item = {}) {
  const p = profileForEquipment(item);
  return Array.isArray(item.ports) && item.ports.length ? item.ports : p.ports;
}
