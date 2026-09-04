/* GLT Flow Card Platform 1.0 component and visual catalog */

import { pair as catalogPair } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";
export const VISUAL_STYLES = [
  { id: "neo2030", label: catalogPair("symbols.style_neo2030") },
  { id: "clean", label: catalogPair("symbols.style_clean") },
  { id: "classic_scada", label: catalogPair("symbols.style_classic_scada") },
  { id: "standard_2d", label: catalogPair("symbols.style_standard_2d") },
  { id: "operations_light", label: catalogPair("symbols.style_operations_light") },
  { id: "pid_dark", label: catalogPair("symbols.style_pid_dark") },
];

const P = (id, label, category, type, ports = [], slots = [], controls = []) => ({
  id, label, category, type, ports, slots, controls,
});
const port = (id, medium, side, direction = "bidirectional") => ({ id, medium, side, direction });
const slot = (id, label, domains = ["sensor"], unit = null) => ({ id, label, domains, unit });
const control = (id, label, command, domains = []) => ({ id, label, command, domains });

export const COMPONENT_PROFILES = [
  P("heat_pump", catalogPair("symbols.profile_heat_pump"), "Heizung", "heat_pump",
    [port("source_in", "source", "left", "in"), port("source_out", "source", "left", "out"), port("supply", "heating_supply", "right", "out"), port("return", "heating_return", "right", "in")],
    [slot("flow_temp", catalogPair("symbols.slot_flow_temp"), ["sensor"], "°C"), slot("return_temp", catalogPair("symbols.slot_return_temp"), ["sensor"], "°C"), slot("power", catalogPair("symbols.slot_power"), ["sensor"], "kW"), slot("cop", catalogPair("symbols.slot_cop"), ["sensor"]), slot("operating_hours", catalogPair("symbols.slot_operating_hours"), ["sensor"], "h")],
    [control("enable", catalogPair("symbols.control_enable"), "toggle", ["switch", "input_boolean"]), control("mode", catalogPair("symbols.control_mode"), "select", ["select", "climate"]) ]),
  P("pump", catalogPair("symbols.profile_pump"), "Hydraulik", "pump",
    [port("in", "hydronic", "left", "in"), port("out", "hydronic", "right", "out")],
    [slot("speed", catalogPair("symbols.slot_speed"), ["sensor", "number"], "%"), slot("power", catalogPair("symbols.slot_power"), ["sensor"], "W"), slot("hours", catalogPair("symbols.slot_hours"), ["sensor"], "h"), slot("starts", catalogPair("symbols.slot_starts"), ["sensor"])],
    [control("run", catalogPair("symbols.control_run"), "toggle", ["switch", "fan"]), control("speed", catalogPair("symbols.control_speed"), "number", ["number", "fan"])]),
  P("valve", catalogPair("symbols.profile_valve"), "Hydraulik", "valve",
    [port("in", "hydronic", "left", "in"), port("out", "hydronic", "right", "out")],
    [slot("position", catalogPair("symbols.slot_position"), ["sensor", "number", "cover"], "%"), slot("feedback", catalogPair("symbols.slot_feedback"), ["binary_sensor", "sensor"])],
    [control("position", catalogPair("symbols.control_position"), "number", ["number", "cover"]), control("open_close", catalogPair("symbols.control_open_close"), "toggle", ["switch", "cover"])]),
  P("mixing_valve", catalogPair("symbols.profile_mixing_valve"), "Hydraulik", "valve",
    [port("hot", "heating_supply", "left", "in"), port("return", "heating_return", "bottom", "in"), port("mixed", "heating_supply", "right", "out")],
    [slot("position", catalogPair("symbols.slot_position"), ["sensor", "number"], "%"), slot("setpoint", catalogPair("symbols.slot_setpoint"), ["sensor", "number"], "°C"), slot("actual", catalogPair("symbols.slot_actual"), ["sensor"], "°C")],
    [control("position", catalogPair("symbols.control_position"), "number", ["number"])]),
  P("tank", catalogPair("symbols.profile_tank"), "Heizung", "tank",
    [port("top", "heating_supply", "right", "out"), port("bottom", "heating_return", "right", "in")],
    [slot("top_temp", catalogPair("symbols.slot_top_temp"), ["sensor"], "°C"), slot("middle_temp", catalogPair("symbols.slot_middle_temp"), ["sensor"], "°C"), slot("bottom_temp", catalogPair("symbols.slot_bottom_temp"), ["sensor"], "°C")]),
  P("dhw_tank", catalogPair("symbols.profile_dhw_tank"), "Heizung", "tank",
    [port("charge_in", "dhw", "left", "in"), port("charge_out", "dhw", "left", "out"), port("dhw_out", "dhw", "right", "out"), port("cold_in", "cold_water", "bottom", "in")],
    [slot("temperature", catalogPair("symbols.slot_temperature"), ["sensor"], "°C"), slot("setpoint", catalogPair("symbols.slot_setpoint"), ["number", "sensor"], "°C")],
    [control("setpoint", catalogPair("symbols.control_setpoint"), "number", ["number", "water_heater"])]),
  P("boiler", catalogPair("symbols.profile_boiler"), "Heizung", "boiler",
    [port("supply", "heating_supply", "right", "out"), port("return", "heating_return", "left", "in")],
    [slot("flow_temp", catalogPair("symbols.slot_flow_temp"), ["sensor"], "°C"), slot("power", catalogPair("symbols.slot_power"), ["sensor"], "kW"), slot("hours", catalogPair("symbols.slot_hours"), ["sensor"], "h")],
    [control("enable", catalogPair("symbols.control_enable"), "toggle", ["switch"])]),
  P("heat_exchanger", catalogPair("symbols.profile_heat_exchanger"), "Hydraulik", "heat_exchanger",
    [port("primary_in", "primary", "left", "in"), port("primary_out", "primary", "left", "out"), port("secondary_in", "secondary", "right", "in"), port("secondary_out", "secondary", "right", "out")],
    [slot("primary_in_temp", catalogPair("symbols.slot_primary_in_temp"), ["sensor"], "°C"), slot("primary_out_temp", catalogPair("symbols.slot_primary_out_temp"), ["sensor"], "°C"), slot("secondary_in_temp", catalogPair("symbols.slot_secondary_in_temp"), ["sensor"], "°C"), slot("secondary_out_temp", catalogPair("symbols.slot_secondary_out_temp"), ["sensor"], "°C")]),
  P("ahu", catalogPair("symbols.profile_ahu"), "RLT", "ahu",
    [port("outdoor", "air_outdoor", "left", "in"), port("supply", "air_supply", "right", "out"), port("extract", "air_extract", "right", "in"), port("exhaust", "air_exhaust", "left", "out")],
    [slot("supply_temp", catalogPair("symbols.slot_supply_temp"), ["sensor"], "°C"), slot("extract_temp", catalogPair("symbols.slot_extract_temp"), ["sensor"], "°C"), slot("supply_flow", catalogPair("symbols.slot_supply_flow"), ["sensor"], "m³/h"), slot("extract_flow", catalogPair("symbols.slot_extract_flow"), ["sensor"], "m³/h"), slot("co2", catalogPair("symbols.slot_co2"), ["sensor"], "ppm")],
    [control("enable", catalogPair("symbols.control_enable"), "toggle", ["switch", "fan"]), control("mode", catalogPair("symbols.control_mode"), "select", ["select"])]),
  P("fan", catalogPair("symbols.profile_fan"), "RLT", "fan",
    [port("in", "air", "left", "in"), port("out", "air", "right", "out")],
    [slot("speed", catalogPair("symbols.slot_speed"), ["sensor", "number", "fan"], "%"), slot("flow", catalogPair("symbols.slot_flow"), ["sensor"], "m³/h"), slot("pressure", catalogPair("symbols.slot_pressure"), ["sensor"], "Pa")],
    [control("run", catalogPair("symbols.control_run"), "toggle", ["fan", "switch"]), control("speed", catalogPair("symbols.control_speed"), "number", ["fan", "number"])]),
  P("damper", catalogPair("symbols.profile_damper"), "RLT", "valve",
    [port("in", "air", "left", "in"), port("out", "air", "right", "out")],
    [slot("position", catalogPair("symbols.slot_position"), ["sensor", "number", "cover"], "%")],
    [control("position", catalogPair("symbols.control_position"), "number", ["number", "cover"])]),
  P("chiller", catalogPair("symbols.profile_chiller"), "Kälte", "heat_pump",
    [port("supply", "cooling_supply", "right", "out"), port("return", "cooling_return", "right", "in"), port("condenser_in", "condenser", "left", "in"), port("condenser_out", "condenser", "left", "out")],
    [slot("supply_temp", catalogPair("symbols.slot_supply_temp"), ["sensor"], "°C"), slot("return_temp", catalogPair("symbols.slot_return_temp"), ["sensor"], "°C"), slot("power", catalogPair("symbols.slot_power"), ["sensor"], "kW")],
    [control("enable", catalogPair("symbols.control_enable"), "toggle", ["switch"])]),
  P("meter", catalogPair("symbols.profile_meter"), "Energie", "meter", [], [slot("value", catalogPair("symbols.slot_value"), ["sensor"]), slot("power", catalogPair("symbols.slot_power"), ["sensor"]) ]),
  P("room", catalogPair("symbols.profile_room"), "Gebäude", "room", [], [slot("temperature", catalogPair("symbols.slot_temperature"), ["sensor", "climate"], "°C"), slot("humidity", catalogPair("symbols.slot_humidity"), ["sensor"], "%"), slot("co2", catalogPair("symbols.slot_co2"), ["sensor"], "ppm"), slot("setpoint", catalogPair("symbols.slot_setpoint"), ["climate", "number"], "°C")], [control("setpoint", catalogPair("symbols.control_setpoint"), "number", ["climate", "number"])]),
  P("generic", catalogPair("symbols.profile_generic"), "Allgemein", "generic", [port("left", "neutral", "left"), port("right", "neutral", "right")], [slot("value", catalogPair("symbols.slot_value"), ["sensor"])])
];

export const BASE_SYMBOLS = [
  ["heat_pump_neo",catalogPair("symbols.symbol_heat_pump_neo"),"Heizung","heat_pump","waermepumpen"],["heat_pump_compact",catalogPair("symbols.symbol_heat_pump_compact"),"Heizung","heat_pump","waermepumpen"],["boiler",catalogPair("symbols.symbol_boiler"),"Heizung","boiler","kessel_erzeuger"],["burner",catalogPair("symbols.symbol_burner"),"Heizung","generic","kessel_erzeuger"],["immersion_heater",catalogPair("symbols.symbol_immersion_heater"),"Heizung","generic","kessel_erzeuger"],["buffer_layered",catalogPair("symbols.symbol_buffer_layered"),"Heizung","tank","puffer_speicher"],["dhw_tank",catalogPair("symbols.symbol_dhw_tank"),"Heizung","dhw_tank","puffer_speicher"],["underfloor",catalogPair("symbols.symbol_underfloor"),"Heizung","room","heizflaechen"],["radiator",catalogPair("symbols.symbol_radiator"),"Heizung","room","heizflaechen"],
  ["pump_inline",catalogPair("symbols.symbol_pump_inline"),"Hydraulik","pump","pumpen"],["pump_variable",catalogPair("symbols.symbol_pump_variable"),"Hydraulik","pump","pumpen"],["pump_twin",catalogPair("symbols.symbol_pump_twin"),"Hydraulik","pump","pumpen"],["pump_dhw",catalogPair("symbols.symbol_pump_dhw"),"Hydraulik","pump","pumpen"],["valve_2way",catalogPair("symbols.symbol_valve_2way"),"Hydraulik","valve","ventile"],["valve_3way",catalogPair("symbols.symbol_valve_3way"),"Hydraulik","valve","ventile"],["mixing_valve",catalogPair("symbols.symbol_mixing_valve"),"Hydraulik","mixing_valve","ventile"],["shutoff_valve",catalogPair("symbols.symbol_shutoff_valve"),"Hydraulik","valve","ventile"],["check_valve",catalogPair("symbols.symbol_check_valve"),"Hydraulik","valve","ventile"],["safety_valve",catalogPair("symbols.symbol_safety_valve"),"Hydraulik","valve","ventile"],["balancing_valve",catalogPair("symbols.symbol_balancing_valve"),"Hydraulik","valve","ventile"],["hydraulic_separator",catalogPair("symbols.symbol_hydraulic_separator"),"Hydraulik","heat_exchanger","waermetauscher"],["heat_exchanger_plate",catalogPair("symbols.symbol_heat_exchanger_plate"),"Hydraulik","heat_exchanger","waermetauscher"],["manifold",catalogPair("symbols.symbol_manifold"),"Hydraulik","generic","verteilung"],["filter_water",catalogPair("symbols.symbol_filter_water"),"Hydraulik","generic","schmutzfaenger"],["dirt_separator",catalogPair("symbols.symbol_dirt_separator"),"Hydraulik","generic","schmutzfaenger"],["expansion_vessel",catalogPair("symbols.symbol_expansion_vessel"),"Hydraulik","tank","ausdehnung"],
  ["ahu",catalogPair("symbols.symbol_ahu"),"RLT","ahu","geraete"],["fan_supply",catalogPair("symbols.symbol_fan_supply"),"RLT","fan","ventilatoren"],["fan_extract",catalogPair("symbols.symbol_fan_extract"),"RLT","fan","ventilatoren"],["damper",catalogPair("symbols.symbol_damper"),"RLT","damper","klappen_regelung"],["fire_damper",catalogPair("symbols.symbol_fire_damper"),"RLT","damper","klappen_regelung"],["air_filter",catalogPair("symbols.symbol_air_filter"),"RLT","generic","filter"],["heating_coil",catalogPair("symbols.symbol_heating_coil"),"RLT","heat_exchanger","register"],["cooling_coil",catalogPair("symbols.symbol_cooling_coil"),"RLT","heat_exchanger","register"],["heat_recovery_rotary",catalogPair("symbols.symbol_heat_recovery_rotary"),"RLT","heat_exchanger","waermerueckgewinnung"],["heat_recovery_plate",catalogPair("symbols.symbol_heat_recovery_plate"),"RLT","heat_exchanger","waermerueckgewinnung"],["humidifier",catalogPair("symbols.symbol_humidifier"),"RLT","generic","befeuchtung"],["silencer",catalogPair("symbols.symbol_silencer"),"RLT","generic","schalldaempfer"],
  ["chiller",catalogPair("symbols.symbol_chiller"),"Kälte","chiller","kaeltemaschinen"],["compressor",catalogPair("symbols.symbol_compressor"),"Kälte","generic","komponenten"],["cooling_tower",catalogPair("symbols.symbol_cooling_tower"),"Kälte","generic","kuehler"],["cooling_buffer",catalogPair("symbols.symbol_cooling_buffer"),"Kälte","tank","speicher"],
  ["pv_array",catalogPair("symbols.symbol_pv_array"),"Energie","generic","photovoltaik"],["inverter",catalogPair("symbols.symbol_inverter"),"Energie","generic","umwandlung"],["battery",catalogPair("symbols.symbol_battery"),"Energie","generic","speicher"],["grid",catalogPair("symbols.symbol_grid"),"Energie","generic","netz_zaehler"],["meter",catalogPair("symbols.symbol_meter"),"Energie","meter","netz_zaehler"],["wallbox",catalogPair("symbols.symbol_wallbox"),"Energie","generic","laden"],
  ["temp_sensor",catalogPair("symbols.symbol_temp_sensor"),"Sensorik","meter","temperatur"],["pressure_sensor",catalogPair("symbols.symbol_pressure_sensor"),"Sensorik","meter","druck"],["dp_sensor",catalogPair("symbols.symbol_dp_sensor"),"Sensorik","meter","druck"],["flow_sensor",catalogPair("symbols.symbol_flow_sensor"),"Sensorik","meter","durchfluss"],["humidity_sensor",catalogPair("symbols.symbol_humidity_sensor"),"Sensorik","meter","feuchte"],["co2_sensor",catalogPair("symbols.symbol_co2_sensor"),"Sensorik","meter","luftqualitaet"],["frost_thermostat",catalogPair("symbols.symbol_frost_thermostat"),"Sensorik","meter","temperatur"],["room_sensor",catalogPair("symbols.symbol_room_sensor"),"Sensorik","room","raum"],
  ["switchgear",catalogPair("symbols.symbol_switchgear"),"Elektro","generic","verteilung"],["busbar",catalogPair("symbols.symbol_busbar"),"Elektro","generic","verteilung"],["sub_distribution_board",catalogPair("symbols.symbol_sub_distribution_board"),"Elektro","generic","verteilung"],["transformer",catalogPair("symbols.symbol_transformer"),"Elektro","generic","versorgung"],["ups",catalogPair("symbols.symbol_ups"),"Elektro","generic","versorgung"],["generator_set",catalogPair("symbols.symbol_generator_set"),"Elektro","generic","versorgung"],["circuit_breaker",catalogPair("symbols.symbol_circuit_breaker"),"Elektro","generic","schutz_schaltung"],["rcd",catalogPair("symbols.symbol_rcd"),"Elektro","generic","schutz_schaltung"],["surge_arrester",catalogPair("symbols.symbol_surge_arrester"),"Elektro","generic","schutz_schaltung"],["isolator_switch",catalogPair("symbols.symbol_isolator_switch"),"Elektro","generic","schutz_schaltung"],
  ["fire_alarm_panel",catalogPair("symbols.symbol_fire_alarm_panel"),"Brandschutz","generic","meldetechnik"],["smoke_detector",catalogPair("symbols.symbol_smoke_detector"),"Brandschutz","meter","meldetechnik"],["heat_detector",catalogPair("symbols.symbol_heat_detector"),"Brandschutz","meter","meldetechnik"],["manual_call_point",catalogPair("symbols.symbol_manual_call_point"),"Brandschutz","generic","meldetechnik"],["aspirating_detector",catalogPair("symbols.symbol_aspirating_detector"),"Brandschutz","meter","meldetechnik"],["sprinkler_head",catalogPair("symbols.symbol_sprinkler_head"),"Brandschutz","generic","loeschanlagen"],["sprinkler_valve_station",catalogPair("symbols.symbol_sprinkler_valve_station"),"Brandschutz","valve","loeschanlagen"],["extinguishing_system",catalogPair("symbols.symbol_extinguishing_system"),"Brandschutz","generic","loeschanlagen"],["fire_barrier",catalogPair("symbols.symbol_fire_barrier"),"Brandschutz","generic","abschottung"],["fire_door",catalogPair("symbols.symbol_fire_door"),"Brandschutz","generic","abschottung"],
["heat_pump_duo",catalogPair("symbols.symbol_heat_pump_duo"),"Heizung","heat_pump","waermepumpen"],["cogen_unit",catalogPair("symbols.symbol_cogen_unit"),"Heizung","boiler","kessel_erzeuger"],["solar_station",catalogPair("symbols.symbol_solar_station"),"Heizung","heat_exchanger","solar"],["flat_collector",catalogPair("symbols.symbol_flat_collector"),"Heizung","generic","solar"],["vacuum_tube_collector",catalogPair("symbols.symbol_vacuum_tube_collector"),"Heizung","generic","solar"],["dhw_freshwater_station",catalogPair("symbols.symbol_dhw_freshwater_station"),"Heizung","heat_exchanger","stationen"],["pump_group",catalogPair("symbols.symbol_pump_group"),"Hydraulik","pump","pumpen"],["flexible_compensator",catalogPair("symbols.symbol_flexible_compensator"),"Hydraulik","generic","ausdehnung"],["pressure_reducing_valve",catalogPair("symbols.symbol_pressure_reducing_valve"),"Hydraulik","valve","ventile"],["backflow_preventer",catalogPair("symbols.symbol_backflow_preventer"),"Hydraulik","valve","ventile"],["compact_ahu",catalogPair("symbols.symbol_compact_ahu"),"RLT","ahu","geraete"],["vav_box",catalogPair("symbols.symbol_vav_box"),"RLT","damper","klappen_regelung"],["ec_fan",catalogPair("symbols.symbol_ec_fan"),"RLT","fan","ventilatoren"],["steam_humidifier",catalogPair("symbols.symbol_steam_humidifier"),"RLT","generic","befeuchtung"],["dry_cooler",catalogPair("symbols.symbol_dry_cooler"),"Kälte","chiller","kuehler"],["brine_station",catalogPair("symbols.symbol_brine_station"),"Kälte","heat_exchanger","sole"],["ice_storage",catalogPair("symbols.symbol_ice_storage"),"Kälte","tank","speicher"],["condensing_unit",catalogPair("symbols.symbol_condensing_unit"),"Kälte","chiller","kaeltemaschinen"],["hybrid_inverter",catalogPair("symbols.symbol_hybrid_inverter"),"Energie","generic","umwandlung"],["fuel_cell",catalogPair("symbols.symbol_fuel_cell"),"Energie","boiler","erzeuger"],["heat_meter",catalogPair("symbols.symbol_heat_meter"),"Energie","meter","netz_zaehler"],["co2_voc_sensor",catalogPair("symbols.symbol_co2_voc_sensor"),"Sensorik","meter","luftqualitaet"],["flow_switch",catalogPair("symbols.symbol_flow_switch"),"Sensorik","meter","durchfluss"],["frequency_drive",catalogPair("symbols.symbol_frequency_drive"),"Elektro","generic","antriebe"],["flue",catalogPair("symbols.symbol_flue"),"Heizung","boiler","kessel_erzeuger"],["solar_controller",catalogPair("symbols.symbol_solar_controller"),"Heizung","generic","solar"],["y_strainer",catalogPair("symbols.symbol_y_strainer"),"Hydraulik","valve","schmutzfaenger"],["flow_limiter",catalogPair("symbols.symbol_flow_limiter"),"Hydraulik","valve","ventile"],["reducer",catalogPair("symbols.symbol_reducer"),"Hydraulik","generic","verteilung"],["booster_station",catalogPair("symbols.symbol_booster_station"),"Hydraulik","pump","pumpen"],["cistern",catalogPair("symbols.symbol_cistern"),"Hydraulik","tank","speicher"],["duct",catalogPair("symbols.symbol_duct"),"RLT","damper","verteilung"],["louvre",catalogPair("symbols.symbol_louvre"),"RLT","damper","klappen_regelung"],["kitchen_hood",catalogPair("symbols.symbol_kitchen_hood"),"RLT","generic","geraete"],["oil_separator",catalogPair("symbols.symbol_oil_separator"),"Kälte","generic","komponenten"],["receiver_drier",catalogPair("symbols.symbol_receiver_drier"),"Kälte","generic","komponenten"],["sight_glass",catalogPair("symbols.symbol_sight_glass"),"Kälte","meter","komponenten"],["suction_accumulator",catalogPair("symbols.symbol_suction_accumulator"),"Kälte","tank","komponenten"],["water_meter",catalogPair("symbols.symbol_water_meter"),"Energie","meter","netz_zaehler"],["main_switch",catalogPair("symbols.symbol_main_switch"),"Elektro","generic","schutz_schaltung"],["motor_protection",catalogPair("symbols.symbol_motor_protection"),"Elektro","generic","schutz_schaltung"],["duct_sensor",catalogPair("symbols.symbol_duct_sensor"),"Sensorik","meter","temperatur"],["gas_sensor",catalogPair("symbols.symbol_gas_sensor"),"Sensorik","meter","luftqualitaet"],["motion_detector",catalogPair("symbols.symbol_motion_detector"),"Sensorik","meter","raum"]
].map(([id,label,category,profile,group])=>({id,label,category,profile,group:group||category}));

/**
 * Join two `{de, en}` labels into one, per language.
 *
 * A variant's name is its symbol and its style, and both are catalog wording
 * now — so the join has to happen per language rather than by interpolating
 * two objects into a template, which produced `[object Object] · [object
 * Object]` the moment the labels stopped being strings.
 */
const joinLabels = (first, second) => Object.freeze(Object.fromEntries(
  Object.keys(first).map((language) => [language, `${first[language]} · ${second[language]}`]),
));

export const SYMBOL_VARIANTS = BASE_SYMBOLS.flatMap((base) => VISUAL_STYLES.map((style) => ({
  id: `${base.id}@${style.id}`,
  base_symbol: base.id,
  label: joinLabels(base.label, style.label),
  category: base.category,
  group: base.group,
  profile: base.profile,
  style: style.id,
})));

/**
 * One catalog label, in one language.
 *
 * Labels are `{de, en}` pairs now, so every render site has to say which
 * language it is rendering. Interpolating the pair into a template produced
 * `[object Object]` — and every suite still passed, because the assertions
 * checked that *something* was rendered rather than what. That is the vacuous
 * pass this codebase has now corrected four times, and it is why this helper
 * exists in one place rather than as a spread of `?.de` accesses.
 */
/**
 * Untergruppen-Labels aus dem Katalog, aufgeschlüsselt nach dem Klartext,
 * den die Basissymbole tragen. Der Klartext bleibt der interne Schlüssel
 * (wie die Hauptgruppe); die Anzeige kommt aus dem Katalog, damit keine
 * ungeprüfte Nutzerzeichenkette im Artefakt landet.
 */
export const SYMBOL_GROUPS = Object.freeze({
  "waermepumpen": catalogPair("symbols.group_waermepumpen"),
  "kessel_erzeuger": catalogPair("symbols.group_kessel_erzeuger"),
  "puffer_speicher": catalogPair("symbols.group_puffer_speicher"),
  "heizflaechen": catalogPair("symbols.group_heizflaechen"),
  "solar": catalogPair("symbols.group_solar"),
  "stationen": catalogPair("symbols.group_stationen"),
  "pumpen": catalogPair("symbols.group_pumpen"),
  "ventile": catalogPair("symbols.group_ventile"),
  "waermetauscher": catalogPair("symbols.group_waermetauscher"),
  "verteilung": catalogPair("symbols.group_verteilung"),
  "schmutzfaenger": catalogPair("symbols.group_schmutzfaenger"),
  "ausdehnung": catalogPair("symbols.group_ausdehnung"),
  "geraete": catalogPair("symbols.group_geraete"),
  "ventilatoren": catalogPair("symbols.group_ventilatoren"),
  "klappen_regelung": catalogPair("symbols.group_klappen_regelung"),
  "filter": catalogPair("symbols.group_filter"),
  "register": catalogPair("symbols.group_register"),
  "waermerueckgewinnung": catalogPair("symbols.group_waermerueckgewinnung"),
  "befeuchtung": catalogPair("symbols.group_befeuchtung"),
  "schalldaempfer": catalogPair("symbols.group_schalldaempfer"),
  "kaeltemaschinen": catalogPair("symbols.group_kaeltemaschinen"),
  "komponenten": catalogPair("symbols.group_komponenten"),
  "kuehler": catalogPair("symbols.group_kuehler"),
  "speicher": catalogPair("symbols.group_speicher"),
  "sole": catalogPair("symbols.group_sole"),
  "photovoltaik": catalogPair("symbols.group_photovoltaik"),
  "umwandlung": catalogPair("symbols.group_umwandlung"),
  "netz_zaehler": catalogPair("symbols.group_netz_zaehler"),
  "laden": catalogPair("symbols.group_laden"),
  "erzeuger": catalogPair("symbols.group_erzeuger"),
  "temperatur": catalogPair("symbols.group_temperatur"),
  "druck": catalogPair("symbols.group_druck"),
  "durchfluss": catalogPair("symbols.group_durchfluss"),
  "feuchte": catalogPair("symbols.group_feuchte"),
  "luftqualitaet": catalogPair("symbols.group_luftqualitaet"),
  "raum": catalogPair("symbols.group_raum"),
  "versorgung": catalogPair("symbols.group_versorgung"),
  "schutz_schaltung": catalogPair("symbols.group_schutz_schaltung"),
  "antriebe": catalogPair("symbols.group_antriebe"),
  "meldetechnik": catalogPair("symbols.group_meldetechnik"),
  "loeschanlagen": catalogPair("symbols.group_loeschanlagen"),
  "abschottung": catalogPair("symbols.group_abschottung"),
});

export function labelText(label, language = "de") {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") return label[language] ?? label.de ?? label.en ?? "";
  return "";
}

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

/* -------------------------------------------------------------------------
 * Symbol geometry, style tokens, and the domains they belong to.
 *
 * `symbolCatalogStats()` used to report the catalog size by measuring array
 * lengths. That proves the array's length: a catalog of 456 rows where every
 * row draws nothing would report 456 just as confidently. Two rows drawing the
 * *same* thing would report 456 too, and both were true here — `ahu`,
 * `wallbox` and `room_sensor` drew nothing at all, and `chiller` was drawn
 * with the heat pump's geometry, `cooling_buffer` with the buffer's,
 * `air_filter` with the water filter's, `shutoff_valve` with the two-way
 * valve's, `heat_recovery_plate` with the plate exchanger's.
 *
 * So geometry lives here as data, one entry per base symbol, and the evidence
 * generator renders every entry and digests it. Distinctness is then a checked
 * property rather than an assumption, and the published count is the number of
 * things that actually drew.
 * ---------------------------------------------------------------------- */

const ln = (x1, y1, x2, y2, cls = "") => ["line", x1, y1, x2, y2, cls];
const rc = (x, y, w, h, r = 2, cls = "") => ["rect", x, y, w, h, r, cls];
const ci = (cx, cy, r, cls = "") => ["circle", cx, cy, r, cls];
const pa = (d, cls = "") => ["path", d, cls];
const tx = (x, y, value, cls = "txt") => ["text", x, y, value, cls];

const TANK_SHELL = "M18 9 Q18 4 32 4 Q46 4 46 9 L46 55 Q46 60 32 60 Q18 60 18 55 Z";
const gauge = (label) => [
  ci(32, 32, 22, "body"), ln(7, 32, 10, 32), ln(54, 32, 57, 32),
  tx(32, 36, label, "txt accent-text"),
];

/**
 * One entry per base symbol. Every entry must be distinct from every other:
 * the cross product of bases and styles is only a set of distinct variants if
 * the bases themselves are distinct, and claiming otherwise is the overclaim
 * CAT-01 exists to retire.
 */
export const SYMBOL_GEOMETRY = new Map([
  // -- Heizung -------------------------------------------------------------
  ["heat_pump_neo", [rc(10, 7, 44, 50, 8, "body"), ci(32, 32, 14, "accent"), pa("M23 34 C26 24 38 24 41 34", "thin"), ln(22, 39, 42, 39, "thin"), ln(3, 18, 10, 18, "cold"), ln(54, 18, 61, 18, "hot")]],
  ["heat_pump_compact", [rc(14, 12, 36, 40, 6, "body"), ci(32, 29, 10, "accent"), pa("M27 31 C29 25 35 25 37 31", "thin"), ln(4, 22, 14, 22, "cold"), ln(50, 22, 60, 22, "hot"), ln(20, 46, 44, 46, "thin")]],
  ["boiler", [rc(12, 9, 40, 46, 7, "body"), pa("M32 46 C20 39 24 29 32 20 C40 29 44 39 32 46 Z", "flame"), ln(3, 18, 12, 18, "cold"), ln(52, 18, 61, 18, "hot")]],
  ["burner", [rc(9, 20, 46, 25, 4, "body"), ci(22, 32, 8, "accent"), pa("M30 32 L47 24 L47 40 Z", "flame")]],
  ["immersion_heater", [ln(3, 32, 16, 32), rc(16, 12, 32, 40, 3, "body"), pa("M22 40 L27 24 L32 40 L37 24 L42 40", "accent"), ln(48, 32, 61, 32), pa("M28 8 L34 8", "power")]],
  ["buffer_layered", [pa(TANK_SHELL, "tank"), rc(20, 10, 24, 20, 0, "hotfill"), rc(20, 34, 24, 20, 0, "coldfill"), ln(8, 18, 18, 18, "hot"), ln(8, 47, 18, 47, "cold"), ln(46, 18, 56, 18, "hot"), ln(46, 47, 56, 47, "cold")]],
  ["dhw_tank", [pa(TANK_SHELL, "tank"), pa("M24 42 C24 34 40 34 40 26 C40 18 24 18 24 11", "accent coil"), ln(8, 14, 18, 14, "hot"), ln(46, 50, 56, 50, "cold")]],
  ["underfloor", [rc(8, 12, 48, 40, 4, "body"), pa("M14 38 C18 20 25 20 29 38 C33 20 40 20 50 38", "hot"), ln(4, 43, 12, 43, "cold"), ln(52, 20, 60, 20, "hot")]],
  ["radiator", [rc(8, 14, 48, 36, 4, "body"), ln(16, 18, 16, 46, "thin"), ln(24, 18, 24, 46, "thin"), ln(32, 18, 32, 46, "thin"), ln(40, 18, 40, 46, "thin"), ln(48, 18, 48, 46, "thin"), ln(2, 43, 8, 43, "cold"), ln(56, 21, 62, 21, "hot")]],

  // -- Hydraulik -----------------------------------------------------------
  ["pump_inline", [ci(32, 32, 19, "body"), pa("M24 43 L24 21 L44 32 Z", "accent rotor"), ln(4, 32, 13, 32), ln(51, 32, 60, 32)]],
  ["pump_variable", [ci(32, 32, 19, "body"), pa("M24 43 L24 21 L44 32 Z", "accent rotor"), ln(4, 32, 13, 32), ln(51, 32, 60, 32), tx(39, 16, "FU")]],
  ["pump_twin", [ci(22, 32, 13, "body"), ci(42, 32, 13, "body"), pa("M17 39 L17 25 L29 32 Z", "accent rotor"), pa("M37 39 L37 25 L49 32 Z", "accent rotor"), ln(3, 32, 9, 32), ln(55, 32, 61, 32)]],
  ["pump_dhw", [ci(32, 36, 15, "body"), pa("M25 45 L25 27 L41 36 Z", "accent rotor"), pa("M14 36 C14 12 50 12 50 36", "thin"), ln(4, 36, 17, 36)]],
  ["valve_2way", [ln(3, 32, 15, 32), pa("M15 20 L32 32 L15 44 Z", "body"), pa("M49 20 L32 32 L49 44 Z", "body"), ln(49, 32, 61, 32)]],
  ["valve_3way", [pa("M10 20 L29 32 L10 44 Z", "body"), pa("M48 20 L29 32 L48 44 Z", "body"), pa("M20 54 L29 32 L38 54 Z", "body"), ln(2, 32, 10, 32), ln(48, 32, 61, 32), ln(29, 54, 29, 62)]],
  ["mixing_valve", [pa("M10 20 L29 32 L10 44 Z", "body"), pa("M48 20 L29 32 L48 44 Z", "body"), pa("M20 54 L29 32 L38 54 Z", "body"), ln(2, 32, 10, 32), ln(48, 32, 61, 32), ln(29, 54, 29, 62), rc(23, 4, 12, 10, 2, "actuator"), ln(29, 14, 29, 28)]],
  ["shutoff_valve", [ln(3, 32, 15, 32), pa("M15 20 L32 32 L15 44 Z", "body"), pa("M49 20 L32 32 L49 44 Z", "body"), ln(49, 32, 61, 32), ln(32, 32, 32, 13, "accent"), ln(23, 13, 41, 13, "accent")]],
  ["check_valve", [ln(3, 32, 16, 32), pa("M16 20 L37 32 L16 44 Z", "body"), ln(40, 19, 40, 45, "accent"), ln(40, 32, 61, 32)]],
  ["safety_valve", [ln(5, 38, 23, 38), pa("M23 28 L36 38 L23 48 Z", "body"), ln(38, 24, 38, 52, "accent"), pa("M38 24 C45 20 45 14 52 11 M48 8 L54 12 L49 16", "accent")]],
  ["balancing_valve", [ln(3, 32, 15, 32), pa("M15 20 L32 32 L15 44 Z", "body"), pa("M49 20 L32 32 L49 44 Z", "body"), ln(49, 32, 61, 32), ci(32, 12, 7, "accent"), ln(32, 19, 32, 27, "thin"), tx(32, 15, "%", "txt accent-text")]],
  ["hydraulic_separator", [rc(22, 7, 20, 50, 8, "tank"), ln(3, 19, 22, 19, "hot"), ln(42, 19, 61, 19, "hot"), ln(3, 45, 22, 45, "cold"), ln(42, 45, 61, 45, "cold"), pa("M28 18 C35 24 29 31 36 37 C39 40 37 46 32 49", "accent")]],
  ["heat_exchanger_plate", [rc(13, 8, 38, 48, 2, "body"), pa("M19 14 L45 50 M45 14 L19 50 M25 10 L25 54 M39 10 L39 54", "thin"), ln(3, 20, 13, 20, "hot"), ln(51, 20, 61, 20, "hot"), ln(3, 44, 13, 44, "cold"), ln(51, 44, 61, 44, "cold")]],
  ["manifold", [rc(10, 24, 44, 16, 5, "body"), ln(15, 12, 15, 24), ln(15, 40, 15, 52), ln(24, 12, 24, 24), ln(24, 40, 24, 52), ln(33, 12, 33, 24), ln(33, 40, 33, 52), ln(42, 12, 42, 24), ln(42, 40, 42, 52), ln(51, 12, 51, 24), ln(51, 40, 51, 52)]],
  ["filter_water", [rc(15, 13, 34, 38, 2, "body"), pa("M18 47 L46 17 M25 49 L49 25 M15 39 L39 15", "thin"), ln(3, 32, 15, 32), ln(49, 32, 61, 32)]],
  ["dirt_separator", [rc(15, 13, 34, 30, 2, "body"), pa("M18 39 L46 17 M25 41 L49 25", "thin"), pa("M22 43 L42 43 L32 60 Z", "body"), ln(3, 28, 15, 28), ln(49, 28, 61, 28)]],
  ["expansion_vessel", [ci(32, 32, 23, "tank"), pa("M10 32 Q32 21 54 32 Q32 43 10 32", "accent"), ln(32, 55, 32, 62)]],

  // -- RLT -----------------------------------------------------------------
  // `ahu` drew nothing before this table existed: it had no branch at all, and
  // the catalog counted it anyway.
  ["ahu", [rc(6, 14, 52, 36, 3, "body"), ln(32, 14, 32, 50, "thin"), ci(19, 23, 6, "accent rotor"), ci(45, 41, 6, "accent rotor"), ln(2, 23, 6, 23, "cold"), ln(58, 23, 62, 23, "hot"), ln(2, 41, 6, 41, "hot"), ln(58, 41, 62, 41, "cold")]],
  ["fan_supply", [ci(32, 32, 20, "body"), pa("M32 31 C31 19 38 14 44 17 C44 24 40 29 33 32 M33 33 C44 35 48 41 44 46 C37 44 33 39 33 34 M31 33 C24 43 17 44 13 38 C17 32 23 30 30 32", "accent rotor"), ln(52, 32, 62, 32, "accent"), pa("M57 28 L62 32 L57 36", "accent")]],
  ["fan_extract", [ci(32, 32, 20, "body"), pa("M32 31 C31 19 38 14 44 17 C44 24 40 29 33 32 M33 33 C44 35 48 41 44 46 C37 44 33 39 33 34 M31 33 C24 43 17 44 13 38 C17 32 23 30 30 32", "accent rotor"), ln(2, 32, 12, 32, "accent"), pa("M7 28 L2 32 L7 36", "accent")]],
  ["damper", [rc(7, 18, 50, 28, 1, "body"), ln(12, 42, 52, 22, "accent"), ci(32, 32, 3, "accent")]],
  ["fire_damper", [rc(7, 18, 50, 28, 1, "body"), ln(12, 42, 52, 22, "alarm"), ci(32, 32, 3, "accent"), tx(43, 15, "BSK", "alarm txt")]],
  ["air_filter", [rc(13, 12, 38, 40, 2, "body"), pa("M13 12 L21 52 L29 12 L37 52 L45 12 L51 40", "thin"), ln(2, 32, 13, 32, "cold"), ln(51, 32, 62, 32, "cold")]],
  ["heating_coil", [rc(9, 12, 46, 40, 2, "body"), pa("M16 42 C23 42 18 22 26 22 C34 22 29 42 37 42 C45 42 40 22 48 22", "hot")]],
  ["cooling_coil", [rc(9, 12, 46, 40, 2, "body"), pa("M16 42 C23 42 18 22 26 22 C34 22 29 42 37 42 C45 42 40 22 48 22", "cold")]],
  ["heat_recovery_rotary", [ci(32, 32, 22, "body"), pa("M32 11 L32 53 M11 32 L53 32 M17 17 L47 47 M47 17 L17 47", "thin"), ci(32, 32, 5, "accent rotor")]],
  ["heat_recovery_plate", [rc(13, 8, 38, 48, 2, "body"), pa("M13 8 L51 56 M51 8 L13 56", "thin"), ln(2, 16, 13, 16, "hot"), ln(51, 16, 62, 16, "cold"), ln(2, 48, 13, 48, "cold"), ln(51, 48, 62, 48, "hot")]],
  ["humidifier", [rc(9, 14, 46, 36, 2, "body"), pa("M20 40 C12 31 20 22 20 22 C20 22 28 31 20 40 Z M34 43 C26 34 34 25 34 25 C34 25 42 34 34 43 Z M46 36 C40 29 46 22 46 22 C46 22 52 29 46 36 Z", "accent")]],
  ["silencer", [rc(7, 16, 50, 32, 2, "body"), ln(15, 19, 21, 45, "thin"), ln(23, 19, 29, 45, "thin"), ln(31, 19, 37, 45, "thin"), ln(39, 19, 45, 45, "thin"), ln(47, 19, 53, 45, "thin")]],

  // -- Kälte ---------------------------------------------------------------
  ["chiller", [rc(10, 7, 44, 50, 8, "body"), ci(32, 32, 14, "cold"), pa("M32 20 L32 44 M22 26 L42 38 M42 26 L22 38", "cold"), ln(3, 18, 10, 18, "cold"), ln(54, 18, 61, 18, "cold")]],
  ["compressor", [ci(32, 32, 23, "body"), pa("M20 40 C25 22 41 20 45 32 C48 42 31 49 24 36", "accent")]],
  ["cooling_tower", [pa("M18 8 L46 8 L52 56 L12 56 Z", "body"), pa("M18 24 C26 18 38 18 46 24 M15 39 C25 33 39 33 49 39", "cold")]],
  ["cooling_buffer", [pa(TANK_SHELL, "tank"), rc(20, 12, 24, 40, 0, "coldfill"), ln(8, 20, 18, 20, "cold"), ln(46, 20, 56, 20, "cold"), ln(8, 46, 18, 46, "cold"), ln(46, 46, 56, 46, "cold")]],

  // -- Energie -------------------------------------------------------------
  ["pv_array", [pa("M10 20 L48 12 L55 44 L17 52 Z", "body"), ln(20, 18, 27, 47, "thin"), ln(30, 18, 37, 47, "thin"), ln(40, 18, 47, 47, "thin"), ln(13, 31, 52, 23, "thin"), ln(16, 42, 55, 34, "thin"), pa("M8 9 L13 14 M3 20 L10 21 M19 3 L20 10", "power")]],
  ["inverter", [rc(10, 12, 44, 40, 6, "body"), pa("M16 31 C21 22 27 40 32 31 C37 22 43 40 48 31", "accent"), ln(3, 32, 10, 32, "power"), ln(54, 32, 61, 32, "power")]],
  ["battery", [rc(12, 15, 40, 34, 5, "body"), rc(26, 9, 12, 6, 2, "body"), rc(17, 21, 30, 22, 3, "batteryfill"), ln(21, 32, 43, 32, "thin")]],
  ["grid", [ln(32, 5, 32, 59, "body"), ln(18, 20, 46, 20, "body"), ln(13, 35, 51, 35, "body"), ln(18, 20, 9, 59, "thin"), ln(46, 20, 55, 59, "thin"), ln(32, 20, 18, 59, "thin"), ln(32, 20, 46, 59, "thin")]],
  ["meter", gauge("M")],
  ["wallbox", [rc(18, 6, 28, 42, 5, "body"), ci(32, 20, 7, "accent"), tx(32, 24, "EV", "txt accent-text"), pa("M28 34 C28 48 38 46 38 60", "power"), ln(46, 16, 60, 16, "power")]],

  // -- Sensorik ------------------------------------------------------------
  ["temp_sensor", gauge("T")],
  ["pressure_sensor", gauge("P")],
  ["dp_sensor", gauge("ΔP")],
  ["flow_sensor", gauge("F")],
  ["humidity_sensor", gauge("%")],
  ["co2_sensor", gauge("CO₂")],
  ["frost_thermostat", gauge("FROST")],
  ["room_sensor", [rc(11, 15, 42, 32, 5, "body"), pa("M11 22 L32 8 L53 22", "thin"), tx(32, 38, "RT", "txt accent-text")]],

  // -- Elektro: distribution, protection, isolation -------------------------
  // Multiplying an absent domain by six styles leaves it absent, so this is
  // base geometry rather than another style.
  ["switchgear", [rc(8, 8, 48, 48, 3, "body"), ln(8, 22, 56, 22, "thin"), ln(8, 38, 56, 38, "thin"), ln(24, 8, 24, 56, "thin"), ln(40, 8, 40, 56, "thin"), ln(32, 2, 32, 8, "power")]],
  ["busbar", [rc(4, 26, 56, 5, 0, "power"), rc(4, 34, 56, 5, 0, "power"), ln(14, 20, 14, 26, "thin"), ln(28, 20, 28, 26, "thin"), ln(42, 20, 42, 26, "thin"), ln(21, 39, 21, 45, "thin"), ln(35, 39, 35, 45, "thin"), ln(49, 39, 49, 45, "thin")]],
  ["sub_distribution_board", [rc(14, 10, 36, 44, 3, "body"), ln(20, 20, 44, 20, "thin"), ln(20, 30, 44, 30, "thin"), ln(20, 40, 44, 40, "thin"), ci(44, 48, 3, "accent"), ln(32, 4, 32, 10, "power")]],
  ["transformer", [ci(24, 32, 15, "body"), ci(40, 32, 15, "body"), ln(4, 32, 9, 32, "power"), ln(55, 32, 60, 32, "power"), ln(32, 12, 32, 52, "thin")]],
  ["ups", [rc(9, 14, 46, 36, 4, "body"), pa("M28 20 L20 34 L30 34 L24 46 L38 30 L28 30 Z", "power"), rc(40, 22, 8, 20, 2, "batteryfill"), ln(2, 32, 9, 32, "power"), ln(55, 32, 62, 32, "power")]],
  ["generator_set", [ci(32, 32, 21, "body"), tx(32, 37, "G", "txt accent-text"), rc(6, 46, 52, 8, 2, "body"), ln(2, 32, 11, 32, "power")]],
  ["circuit_breaker", [ln(32, 4, 32, 20, "power"), ln(32, 44, 32, 60, "power"), ci(32, 20, 3, "accent"), pa("M32 20 L46 40", "body"), pa("M40 30 L52 30 L52 42", "thin"), ci(32, 44, 3, "accent")]],
  ["rcd", [rc(16, 10, 32, 44, 3, "body"), ci(32, 26, 9, "accent"), pa("M27 26 C29 21 35 31 37 26", "thin"), tx(32, 46, "FI", "txt accent-text"), ln(32, 2, 32, 10, "power"), ln(32, 54, 32, 62, "power")]],
  ["surge_arrester", [rc(22, 12, 20, 40, 2, "body"), pa("M32 18 L26 32 L34 32 L28 46", "power"), ln(32, 2, 32, 12, "power"), pa("M26 56 L38 56 M28 60 L36 60", "thin"), ln(32, 52, 32, 56, "thin")]],
  ["isolator_switch", [ln(32, 4, 32, 22, "power"), ci(32, 22, 3, "accent"), pa("M32 22 L48 38", "body"), ln(32, 42, 32, 60, "power"), ci(32, 42, 3, "accent"), pa("M14 30 L22 30 M18 26 L18 34", "thin")]],

  // -- Brandschutz: detection, suppression, rated separation -----------------
  ["fire_alarm_panel", [rc(8, 10, 48, 44, 4, "body"), rc(14, 16, 36, 14, 2, "alarm"), ci(19, 40, 4, "alarm"), ci(31, 40, 4, "thin"), ci(43, 40, 4, "thin"), tx(32, 51, "BMZ", "alarm txt")]],
  ["smoke_detector", [ci(32, 30, 20, "body"), ci(32, 30, 8, "alarm"), ln(12, 50, 52, 50, "body"), pa("M22 18 C26 12 22 8 26 4 M38 18 C42 12 38 8 42 4", "thin")]],
  ["heat_detector", [ci(32, 30, 20, "body"), pa("M32 40 C24 34 27 24 32 18 C37 24 40 34 32 40 Z", "flame"), ln(12, 50, 52, 50, "body")]],
  ["manual_call_point", [rc(12, 12, 40, 40, 3, "alarm"), rc(20, 20, 24, 16, 1, "body"), pa("M22 44 L42 44", "thin"), tx(32, 34, "!", "txt")]],
  ["aspirating_detector", [rc(14, 26, 36, 24, 3, "body"), ln(4, 14, 60, 14, "thin"), ci(16, 14, 3, "accent"), ci(32, 14, 3, "accent"), ci(48, 14, 3, "accent"), ln(32, 14, 32, 26, "thin"), tx(32, 42, "RAS", "txt accent-text")]],
  ["sprinkler_head", [ln(32, 4, 32, 22, "cold"), rc(26, 22, 12, 10, 2, "body"), ci(32, 36, 5, "alarm"), pa("M18 52 C22 44 26 42 30 40 M46 52 C42 44 38 42 34 40", "cold"), ln(20, 32, 44, 32, "thin")]],
  ["sprinkler_valve_station", [ln(32, 2, 32, 16, "cold"), pa("M20 16 L32 26 L20 36 Z", "body"), pa("M44 16 L32 26 L44 36 Z", "body"), ln(32, 36, 32, 48, "cold"), ci(48, 26, 7, "alarm"), tx(48, 30, "A", "txt"), rc(20, 48, 24, 10, 2, "body")]],
  ["extinguishing_system", [rc(16, 14, 14, 40, 6, "body"), rc(34, 14, 14, 40, 6, "body"), ln(23, 6, 23, 14, "alarm"), ln(41, 6, 41, 14, "alarm"), ln(14, 6, 50, 6, "alarm"), tx(32, 40, "LÖ", "txt accent-text")]],
  ["fire_barrier", [rc(4, 22, 56, 20, 1, "alarm"), pa("M10 22 L10 42 M18 22 L18 42 M26 22 L26 42 M34 22 L34 42 M42 22 L42 42 M50 22 L50 42", "thin"), ln(4, 12, 60, 12, "body"), ln(4, 52, 60, 52, "body"), tx(32, 36, "EI90", "txt")]],
  ["fire_door", [rc(14, 6, 36, 52, 2, "body"), ci(43, 34, 3, "accent"), pa("M20 12 L20 52", "thin"), tx(32, 26, "T30", "alarm txt"), pa("M8 6 L8 58 M56 6 L56 58", "thin")]],

  // -- Erweiterung: Erzeuger, Solar, Stationen, Hydraulik, RLT, Kälte, Energie,
  //    Sensorik, Elektro — jede Geometrie eigenständig, geprüft durch Evidence.
  ["heat_pump_duo", [rc(4, 14, 26, 36, 4, "body"), rc(34, 14, 26, 36, 4, "body"), ci(17, 32, 8, "accent"), ci(47, 32, 8, "accent"), pa("M13 34 C15 27 21 27 23 34", "thin"), pa("M43 34 C45 27 51 27 53 34", "thin"), ln(30, 32, 34, 32, "thin"), ln(2, 22, 4, 22, "cold"), ln(60, 22, 62, 22, "hot")]],
  ["cogen_unit", [rc(8, 18, 48, 28, 4, "body"), pa("M14 40 L14 26 L20 26 L20 40 L26 40 L26 26 L32 26 L32 40", "thin"), pa("M40 40 C37 34 41 30 44 26 C47 30 51 34 48 40 Z", "flame"), ln(32, 8, 32, 18, "power"), ln(3, 30, 8, 30, "hot"), ln(56, 30, 61, 30, "hot")]],
  ["solar_station", [rc(6, 14, 28, 36, 4, "body"), ci(20, 32, 8, "body"), pa("M16 36 L16 28 L26 32 Z", "accent rotor"), pa("M40 16 L52 16 L52 48 L40 48 Z", "body"), pa("M43 20 L49 20 M43 26 L49 26 M43 32 L49 32 M43 38 L49 38 M43 44 L49 44", "thin"), ln(34, 32, 40, 32, "hot"), ln(52, 22, 60, 22, "hot"), ln(52, 42, 60, 42, "cold")]],
  ["flat_collector", [pa("M12 48 L48 20 L56 28 L20 56 Z", "body"), ln(22, 42, 30, 50, "thin"), ci(18, 14, 5, "accent"), ln(18, 5, 18, 8, "accent"), ln(9, 14, 12, 14, "accent"), ln(25, 8, 23, 11, "accent"), ln(48, 60, 48, 56, "hot")]],
  ["vacuum_tube_collector", [rc(8, 12, 8, 40, 4, "body"), rc(20, 12, 8, 40, 4, "body"), rc(32, 12, 8, 40, 4, "body"), rc(44, 12, 8, 40, 4, "body"), rc(6, 6, 50, 6, 2, "body"), ln(56, 9, 60, 9, "hot"), ln(56, 12, 60, 12, "cold")]],
  ["dhw_freshwater_station", [rc(8, 10, 20, 44, 2, "body"), pa("M12 16 L24 16 M12 22 L24 22 M12 28 L24 28 M12 34 L24 34 M12 40 L24 40 M12 46 L24 46", "thin"), ci(42, 22, 9, "body"), pa("M38 26 L38 18 L48 22 Z", "accent rotor"), ci(42, 46, 9, "body"), pa("M38 50 L38 42 L48 46 Z", "accent rotor"), ln(28, 22, 33, 22, "hot"), ln(28, 46, 33, 46, "cold"), ln(3, 32, 8, 32, "cold")]],
  ["pump_group", [rc(8, 10, 48, 8, 2, "body"), ci(20, 36, 11, "body"), ci(44, 36, 11, "body"), pa("M15 40 L15 30 L27 36 Z", "accent rotor"), pa("M39 40 L39 30 L51 36 Z", "accent rotor"), ln(20, 18, 20, 25, "thin"), ln(44, 18, 44, 25, "thin"), ln(3, 14, 8, 14, "hot"), ln(56, 14, 61, 14, "hot")]],
  ["flexible_compensator", [ln(3, 32, 16, 32), ln(48, 32, 61, 32), pa("M16 32 Q20 22 24 32 Q28 42 32 32 Q36 22 40 32 Q44 42 48 32", "body"), ln(16, 20, 48, 20, "thin"), ln(16, 44, 48, 44, "thin")]],
  ["pressure_reducing_valve", [rc(10, 22, 44, 20, 3, "body"), pa("M22 26 L42 26 L32 40 Z", "accent"), pa("M32 22 L32 10 M26 14 L32 8 L38 14", "thin"), ln(3, 32, 10, 32, "hot"), ln(54, 32, 61, 32, "cold")]],
  ["backflow_preventer", [rc(8, 22, 48, 20, 3, "body"), pa("M14 26 L14 38 L26 32 Z", "accent"), pa("M38 26 L38 38 L50 32 Z", "accent"), ln(3, 32, 8, 32, "hot"), ln(56, 32, 61, 32, "hot")]],
  ["compact_ahu", [rc(6, 16, 52, 32, 3, "body"), ci(17, 32, 8, "accent"), pa("M13 34 C15 28 21 28 23 34", "thin"), pa("M30 20 L30 44 M30 24 L36 24 M30 30 L36 30 M30 36 L36 36 M30 42 L36 42", "thin"), ln(44, 20, 44, 44, "thin"), ln(44, 20, 52, 20, "hot"), ln(44, 44, 52, 44, "cold"), ln(3, 32, 6, 32, "body")]],
  ["vav_box", [rc(4, 24, 56, 16, 2, "body"), ln(12, 26, 12, 38, "accent"), ln(12, 26, 52, 38, "accent"), rc(24, 44, 16, 12, 2, "accent"), ln(3, 32, 4, 32, "body"), ln(60, 32, 61, 32, "body")]],
  ["ec_fan", [ci(24, 36, 15, "body"), pa("M16 41 L16 29 L34 36 Z", "accent rotor"), rc(42, 10, 16, 16, 3, "accent"), tx(50, 20, "FU", "txt")]],
  ["steam_humidifier", [rc(18, 26, 28, 30, 4, "body"), pa("M24 20 C22 14 26 12 24 6 M32 20 C30 14 34 12 32 6 M40 20 C38 14 42 12 40 6", "thin"), ln(24, 56, 24, 60, "hot"), ln(40, 56, 40, 60, "hot")]],
  ["dry_cooler", [pa("M8 40 L32 20 L56 40", "body"), pa("M8 40 L32 28 L56 40", "body"), ci(20, 40, 7, "accent"), ci(44, 40, 7, "accent"), ln(8, 46, 56, 46, "thin")]],
  ["brine_station", [rc(8, 12, 22, 40, 3, "body"), pa("M12 18 L26 18 M12 24 L26 24 M12 30 L26 30 M12 36 L26 36 M12 42 L26 42 M12 48 L26 48", "thin"), ci(44, 24, 9, "body"), pa("M40 28 L40 20 L50 24 Z", "accent rotor"), rc(40, 40, 8, 14, 4, "body"), ln(30, 24, 35, 24, "hot"), ln(3, 32, 8, 32, "cold")]],
  ["ice_storage", [pa(TANK_SHELL, "tank"), pa("M24 40 L40 40 M32 32 L32 48 M26 36 L38 44 M38 36 L26 44", "coldfill"), ln(8, 18, 18, 18, "hot"), ln(46, 18, 56, 18, "cold")]],
  ["condensing_unit", [rc(8, 14, 32, 26, 3, "body"), pa("M12 20 L36 20 M12 26 L36 26 M12 32 L36 32", "thin"), ci(50, 27, 9, "accent"), pa("M46 31 L46 23 L56 27 Z", "accent rotor"), ln(3, 27, 8, 27, "hot"), rc(20, 44, 10, 10, 3, "body"), ln(24, 40, 24, 44, "thin")]],
  ["hybrid_inverter", [rc(12, 18, 40, 28, 3, "body"), pa("M18 40 L28 24 L38 40 Z", "accent"), ln(32, 10, 32, 18, "power"), pa("M44 46 L52 54 M52 46 L44 54", "power"), ln(3, 32, 12, 32, "hot")]],
  ["fuel_cell", [rc(16, 24, 32, 24, 3, "body"), pa("M20 30 L44 30 M20 36 L44 36 M20 42 L44 42", "thin"), rc(6, 10, 12, 22, 5, "body"), tx(12, 24, "H2", "txt"), ln(48, 36, 61, 36, "power"), ln(32, 48, 32, 60, "hot")]],
  ["heat_meter", [rc(20, 14, 24, 20, 3, "body"), tx(32, 26, "kWh", "txt"), ci(32, 46, 9, "body"), pa("M28 50 L28 42 L38 46 Z", "accent rotor"), ln(3, 46, 23, 46, "hot"), ln(41, 46, 61, 46, "cold"), ln(32, 34, 32, 37, "thin")]],
  ["co2_voc_sensor", [ci(32, 34, 18, "body"), tx(32, 38, "CO2", "accent txt"), pa("M22 12 Q27 8 32 12 Q37 16 42 12", "thin"), ci(46, 46, 4, "accent")]],
  ["flow_switch", [ln(3, 32, 61, 32, "body"), pa("M28 32 L28 18 L40 24 L28 30", "accent"), ci(34, 32, 3, "accent"), ln(28, 18, 22, 10, "thin")]],
  ["frequency_drive", [rc(12, 16, 40, 32, 3, "body"), pa("M18 42 L30 42 L46 22", "accent"), tx(32, 14, "FU", "txt"), ln(3, 32, 12, 32, "power"), ln(52, 32, 61, 32, "power")]],
  ["flue", [rc(18, 8, 28, 6, 2, "accent"), rc(24, 14, 16, 44, 2, "body"), ln(28, 20, 28, 54, "thin"), ln(36, 20, 36, 54, "thin"), pa("M30 5 C27 2 33 2 30 -1", "thin")]],
  ["solar_controller", [rc(12, 16, 40, 32, 4, "body"), ci(24, 32, 7, "accent"), ln(24, 21, 24, 17, "accent"), ln(24, 43, 24, 47, "accent"), ln(13, 32, 17, 32, "accent"), ln(31, 32, 35, 32, "accent"), ln(36, 24, 44, 24, "hot"), ln(36, 40, 44, 40, "cold"), tx(44, 33, "S", "txt")]],
  ["y_strainer", [ln(4, 32, 20, 32, "hot"), rc(20, 22, 14, 20, 3, "body"), ln(34, 32, 60, 32, "hot"), pa("M27 42 L45 58", "body"), ln(31, 46, 41, 56, "thin"), ln(36, 50, 46, 60, "thin")]],
  ["flow_limiter", [rc(14, 22, 36, 20, 3, "body"), pa("M22 26 L42 26 L32 38 Z", "accent"), pa("M32 22 L32 12 M26 16 L32 10 L38 16", "thin"), pa("M50 32 L58 32 M55 29 L58 32 L55 35", "thin")]],
  ["reducer", [pa("M6 20 L30 20 L58 28 L58 36 L30 44 L6 44 Z", "body"), ln(30, 20, 30, 44, "thin"), ln(6, 20, 6, 44, "thin")]],
  ["booster_station", [rc(8, 44, 48, 8, 2, "body"), rc(18, 16, 8, 28, 3, "body"), rc(38, 16, 8, 28, 3, "body"), ci(22, 30, 3, "accent"), ci(42, 30, 3, "accent"), ln(3, 48, 8, 48, "cold"), ln(56, 48, 61, 48, "hot")]],
  ["cistern", [pa("M20 18 Q20 10 32 10 Q44 10 44 18 L44 54 Q44 60 32 60 Q20 60 20 54 Z", "tank"), pa("M14 4 L12 8 M32 2 L30 6 M50 4 L48 8", "cold"), ln(44, 36, 60, 36, "cold")]],
  ["duct", [rc(8, 22, 48, 20, 2, "body"), pa("M16 32 L28 32 M24 28 L28 32 L24 36", "thin"), pa("M36 32 L48 32 M44 28 L48 32 L44 36", "thin")]],
  ["louvre", [rc(10, 14, 44, 36, 2, "body"), pa("M14 22 L50 18 M14 30 L50 26 M14 38 L50 34 M14 46 L50 42", "thin")]],
  ["kitchen_hood", [pa("M16 26 L48 26 L42 12 L22 12 Z", "body"), rc(28, 4, 8, 8, 1, "body"), pa("M20 30 L44 30 M22 35 L42 35 M24 40 L40 40", "thin")]],
  ["oil_separator", [rc(16, 14, 32, 40, 8, "body"), rc(20, 38, 24, 12, 2, "hotfill"), ci(26, 44, 2, "accent"), ci(38, 46, 2, "accent"), ln(8, 24, 16, 24, "hot"), ln(48, 24, 56, 24, "hot")]],
  ["receiver_drier", [rc(24, 12, 16, 44, 7, "body"), pa("M24 24 L40 24 M24 32 L40 32 M24 40 L40 40 M24 48 L40 48", "thin"), ln(32, 4, 32, 12, "hot"), ln(32, 56, 32, 60, "cold")]],
  ["sight_glass", [ln(4, 32, 60, 32, "body"), ci(32, 32, 9, "accent"), ci(32, 32, 5, "thin"), ci(24, 32, 1.5, "thin"), ci(40, 32, 1.5, "thin")]],
  ["suction_accumulator", [rc(22, 10, 20, 48, 8, "body"), pa("M8 24 C14 24 16 20 22 20", "cold"), pa("M42 44 L58 44 L58 24", "cold"), pa("M14 54 C20 54 22 50 22 50", "thin")]],
  ["water_meter", [ln(4, 32, 60, 32, "body"), ci(32, 32, 12, "accent"), ci(32, 32, 8, "body"), ln(32, 32, 38, 26, "thin"), tx(32, 54, "m3", "txt")]],
  ["main_switch", [rc(14, 10, 36, 44, 4, "body"), pa("M32 40 L32 24 M24 24 L40 24", "accent"), pa("M32 24 C26 18 38 14 32 8", "thin"), ln(6, 32, 14, 32, "power"), ln(50, 32, 58, 32, "power")]],
  ["motor_protection", [rc(12, 14, 40, 36, 4, "body"), pa("M20 40 L26 28 L32 40 L38 28 L44 40", "accent"), ln(12, 48, 52, 48, "thin"), tx(32, 20, "M", "txt")]],
  ["duct_sensor", [rc(8, 26, 48, 12, 2, "body"), ci(46, 20, 6, "accent"), ln(46, 26, 46, 20, "thin"), tx(32, 22, "T", "txt")]],
  ["gas_sensor", [ci(32, 34, 16, "body"), tx(32, 38, "GAS", "accent txt"), pa("M22 12 Q27 8 32 12 Q37 16 42 12", "thin"), ci(46, 44, 4, "accent")]],
  ["motion_detector", [pa("M18 44 Q18 20 32 20 Q46 20 46 44 Z", "body"), rc(16, 44, 32, 6, 2, "body"), pa("M10 34 Q8 24 14 16", "thin"), pa("M54 34 Q56 24 50 16", "thin")]],
]);

/**
 * The domain each catalog category belongs to.
 *
 * The categories are German because that is what an operator reads. The domain
 * ids are stable and language-independent, because a requirement that names
 * "fire" must not depend on how the label is spelled this release.
 */
export const DOMAINS = Object.freeze([
  { id: "heating", category: "Heizung", label: catalogPair("symbols.category_heizung") },
  { id: "hydraulics", category: "Hydraulik", label: catalogPair("symbols.category_hydraulik") },
  { id: "air", category: "RLT", label: catalogPair("symbols.category_rlt") },
  { id: "refrigeration", category: "Kälte", label: catalogPair("symbols.category_kalte") },
  { id: "energy", category: "Energie", label: catalogPair("symbols.category_energie") },
  { id: "instrumentation", category: "Sensorik", label: catalogPair("symbols.category_sensorik") },
  { id: "electrical", category: "Elektro", label: catalogPair("symbols.category_elektro") },
  { id: "fire", category: "Brandschutz", label: catalogPair("symbols.category_brandschutz") },
]);

const DOMAIN_BY_CATEGORY = new Map(DOMAINS.map((domain) => [domain.category, domain.id]));

export function domainForCategory(category) {
  return DOMAIN_BY_CATEGORY.get(category) ?? null;
}

/**
 * What a style actually changes.
 *
 * Held as values rather than as a stylesheet so that a style can be digested,
 * compared and contrast-checked. A style whose tokens equal another's is not a
 * second variant of anything, and the evidence generator refuses it.
 */
export const STYLE_TOKENS = Object.freeze({
  neo2030: { background: "#0b1220", surface: "#131c2e", stroke: "#e5e7eb", muted: "#94a3b8", accent: "#38bdf8", hot: "#ef4444", cold: "#3b82f6", power: "#eab308", alarm: "#f43f5e", radius: 14, stroke_width: 2.2, line_cap: "round", grid: 24 },
  clean: { background: "#ffffff", surface: "#f6f8fa", stroke: "#1f2937", muted: "#6b7280", accent: "#2563eb", hot: "#dc2626", cold: "#2563eb", power: "#b45309", alarm: "#b91c1c", radius: 10, stroke_width: 2, line_cap: "round", grid: 20 },
  classic_scada: { background: "#0f2016", surface: "#16301f", stroke: "#d1fae5", muted: "#6ee7b7", accent: "#34d399", hot: "#fb7185", cold: "#60a5fa", power: "#fbbf24", alarm: "#f87171", radius: 4, stroke_width: 2.6, line_cap: "square", grid: 16 },
  standard_2d: { background: "#e8ecef", surface: "#f4f6f7", stroke: "#17212b", muted: "#5f6d79", accent: "#0d6a8e", hot: "#b91c1c", cold: "#1d4ed8", power: "#a16207", alarm: "#991b1b", radius: 4, stroke_width: 1.8, line_cap: "butt", grid: 10 },
  operations_light: { background: "#f7fafc", surface: "#ffffff", stroke: "#182231", muted: "#64748b", accent: "#087f8c", hot: "#c2410c", cold: "#0369a1", power: "#a16207", alarm: "#be123c", radius: 12, stroke_width: 2.4, line_cap: "round", grid: 30 },
  pid_dark: { background: "#0b0e10", surface: "#111517", stroke: "#e5e7eb", muted: "#9ca3af", accent: "#67e8f9", hot: "#f87171", cold: "#7dd3fc", power: "#facc15", alarm: "#fb7185", radius: 2, stroke_width: 3, line_cap: "square", grid: 24 },
});

const STROKE_BY_CLASS = {
  hot: "hot", cold: "cold", power: "power", alarm: "alarm",
  accent: "accent", "accent-text": "accent", rotor: "accent",
  thin: "muted", body: "stroke", tank: "stroke", txt: "stroke",
};

function strokeFor(cls, tokens) {
  for (const part of String(cls).split(/\s+/u)) {
    const token = STROKE_BY_CLASS[part];
    if (token) return tokens[token];
  }
  return tokens.stroke;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/gu, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]
  ));
}

/** One primitive as SVG, with the style's tokens resolved into attributes. */
function renderPrimitive(primitive, tokens) {
  const [kind] = primitive;
  const stroke = strokeFor(primitive[primitive.length - 1], tokens);
  const common = `stroke="${stroke}" stroke-width="${tokens.stroke_width}" stroke-linecap="${tokens.line_cap}"`;
  if (kind === "line") {
    const [, x1, y1, x2, y2] = primitive;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${common}/>`;
  }
  if (kind === "rect") {
    const [, x, y, w, h, r] = primitive;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" ${common}/>`;
  }
  if (kind === "circle") {
    const [, cx, cy, r] = primitive;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${common}/>`;
  }
  if (kind === "path") {
    const [, d] = primitive;
    return `<path d="${escapeXml(d)}" fill="none" ${common}/>`;
  }
  if (kind === "text") {
    const [, x, y, value] = primitive;
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" font-weight="700" fill="${stroke}" stroke="none">${escapeXml(value)}</text>`;
  }
  throw new Error(`unknown symbol primitive: ${String(kind)}`);
}

/**
 * Render one variant.
 *
 * The `<title>` is not decoration: in forced-colours mode a viewer may lose
 * every distinction this drawing makes with colour, and a name is what is left.
 */
export function renderVariant(baseId, styleId, language = "de") {
  const geometry = SYMBOL_GEOMETRY.get(baseId);
  if (!geometry) throw new Error(`no geometry for base symbol: ${String(baseId)}`);
  const tokens = STYLE_TOKENS[styleId];
  if (!tokens) throw new Error(`unknown visual style: ${String(styleId)}`);
  const base = BASE_SYMBOLS.find((entry) => entry.id === baseId);
  const body = geometry.map((primitive) => renderPrimitive(primitive, tokens)).join("");
  return `<svg viewBox="0 0 64 64" role="img" data-base="${escapeXml(baseId)}" data-style="${escapeXml(styleId)}">`
    + `<title>${escapeXml(labelText(base?.label, language) || baseId)}</title>${body}</svg>`;
}

/** The geometry of a base symbol, style-independent: what makes it that symbol. */
export function baseGeometrySource(baseId) {
  const geometry = SYMBOL_GEOMETRY.get(baseId);
  if (!geometry) throw new Error(`no geometry for base symbol: ${String(baseId)}`);
  return JSON.stringify(geometry);
}

/** The token set of a style, canonically ordered so a digest is stable. */
export function styleTokenSource(styleId) {
  const tokens = STYLE_TOKENS[styleId];
  if (!tokens) throw new Error(`unknown visual style: ${String(styleId)}`);
  return JSON.stringify(Object.keys(tokens).sort().map((key) => [key, tokens[key]]));
}
