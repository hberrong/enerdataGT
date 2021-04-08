
const SVG_SIZE = {
	WIDTH: screen.availWidth,
	HEIGHT: screen.availHeight
};

const ZOOM_CONSTRAINTS = [1.5, 100];
const ZOOM_TRANSITION_SPEED = 750;

const DATA_TO_FILENAME = {
	"solar":"data/solar_PV.json",
 	"wind": "data/wind_cleaned.json",
 	"geothermal": "data/geothermal_cleaned.json"
}

// Variables
var data_loaded = [];
var plants = [];
var demand = [];
var next_plant_id = 0;
var selected_plant_id = -1;
var map_bounds;
var usJson = {};
var images = {};

// Fields
var plant_lat_input = d3.select("#plant_lat");
var plant_lng_input = d3.select("#plant_lng");
var plant_type_select = d3.select("#plant_type");
var plant_capacity_input = d3.select("#plant_capacity")
d3.select("#update_plant").on("click", update_plant_details);
d3.select("#reset_plant").on("click", reset_plant_details);

// Define projection and path required for Choropleth
var projection = d3.geoAlbersUsa();
var geoGenerator = d3.geoPath().projection(projection);
var map_zoomer = d3.zoom().scaleExtent(ZOOM_CONSTRAINTS).on("zoom", zoom_map);

// Create svg
var svg = d3.select("div#choropleth").append("svg")
	.call(map_zoomer)
	.on("click", reset_zoom);
const SVG_BOUNDS = svg.node().getBoundingClientRect();

var map_g = svg.append("g").attr("id", "map");
var states_g = map_g.append("g").attr("id", "states");
var plant_g = map_g.append("g").attr("id", "plants");
var data_selectors = d3.selectAll(".data-selector").on("click", select_data);
var new_source_icons = d3.selectAll(".new-source");
var state_selected = "United States"
var selected_year = "1990"
var dragdrop_item = d3.select("body").append("div").attr("id", "dragdrop-item").style("top", "-100px").style("left", "-100px");
var dragdrop_img = dragdrop_item.append("img");
new_source_icons.call(d3.drag()
	.on("start", drag_new_source_start)
	.on("drag", drag_new_source)
	.on("end", drag_new_source_end)
);

var powerplant_toggle = d3.select("#powerplants-selector").on("click", update_displayed_plants);

//Define wind color scale
var greens = d3.interpolateGreens;
var wind_color = d3.scaleSequential(greens);

//Define solar color scale
var oranges = d3.interpolateOranges;
var solar_color = d3.scaleSequential(oranges);

//Define geothermal color scale
var geothermal_color = d3.scaleOrdinal()
.range(['#fff5f0','#fee0d2','#fcbba1','#fc9272',
'#fb6a4a','#ef3b2c','#cb181d','#a50f15','#67000d']);

// Define Tool Tip
var plant_tooltip = d3.tip()
  	    .attr('class', 'd3-tip')
  	    .offset([-10, 0])
  	    .html(p => {
    	      return "<strong>Plant Name:</strong> <span style='color:white'>" + p.name + "</span><br>" +
	        "<strong>Capacity:</strong> <span style='color:white'>" + Math.round(p.capacity) + "<strong> MW</strong>" + "</span>";
  	    })
svg.call(plant_tooltip);

var new_source_tooltip = d3.tip()
	.attr("class", "d3-tip")
	.offset([-10, 0])
	.html(p => console.log(p));


// Position our loader
var loader = d3.select(".loader")
	.style("top", `${(SVG_SIZE.HEIGHT / 2) - 40}px`)
	.style("left", `${(SVG_SIZE.WIDTH / 2) - 40}px`);

// function to get max of array for color scales
function getMax(arr, prop) {
	var max;
	for (var i=0 ; i<arr.length ; i++) {
		if (max == null || arr[i]['properties'][prop] > max)
				max = arr[i]['properties'][prop];
		}
	return max;
}

// function to get min of array for color scales
function getMin(arr, prop) {
	var min;
	for (var i=0 ; i<arr.length ; i++) {
		if (min == null || arr[i]['properties'][prop] < min)
				min = arr[i]['properties'][prop];
		}
	return min;
}


// Create demand dashboard - function
function updateDemandDashboard() {
	var year = d3.select("#selectButton").property("value");
	var data = demand.find(d => d.year == year && d.state == state_selected);

	// https://www.codegrepper.com/code-examples/whatever/how+to+remove+dots+in+unordered+list+html
	d3.select("#demand-title").text(`Energy Demand (${state_selected})`);
	d3.select("#demand-total").text(`Total: ${data.total} MW`);
	d3.select("#demand-residential").text(`Residential: ${data.residential} MW`);
	d3.select("#demand-commercial").text(`Commercial: ${data.commercial} MW`);
	d3.select("#demand-industrial").text(`Industrial: ${data.industrial} MW`);
}

// Load map
d3.json("united_states.json").then(mapData => createMap(mapData));

// Load other data
Promise.all([
	d3.csv("data/powerplants_sanitized.csv", row => {
		var plant_types = row["plant_types_all"].split(",");
		var plant_caps = row["plant_caps_all"].split(",").map(x => parseFloat(x));
		// console.log(plant_caps);
		var new_plant = {
			id: ++next_plant_id,
			lng: +row["longitude"],
			lat: +row["latitude"],
			plant_type: row["plant_type"],
			state: row["state_long"],
			capacity: +row["total_cap"],
			// state_short: d["state"],
			is_renewable: row["renewable"] == "true",
			name: row["plant_name"],
			sub_plants: {}
		}

		plant_types.forEach((p, idx) => {
			new_plant.sub_plants[p] = plant_caps[idx];
		});

		return new_plant;
	}),
	d3.csv("data/demand.csv", d => {
		return {
			year: d.YEAR,
			st: d.ST,
			state: d.STATE,
			residential: d.RESIDENTIAL,
			commercial: d.COMMERCIAL,
			industrial: d.INDUSTRIAL,
			other: d.OTHER,
			transportation: d.TRANSPORTATION,
			total: d.TOTAL
		}
	}),
	d3.xml("images/biomass.svg"),
	d3.xml("images/coal.svg"),
	d3.xml("images/geothermal.svg"),
	d3.xml("images/hydro.svg"),
	d3.xml("images/natural_gas.svg"),
	d3.xml("images/nuclear.svg"),
	d3.xml("images/other_fossil_gasses.svg"),
	d3.xml("images/other.svg"),
	d3.xml("images/petroleum.svg"),
	d3.xml("images/pumped_storage.svg"),
	d3.xml("images/solar.svg"),
	d3.xml("images/wind.svg"),
	d3.xml("images/wood.svg"),
]).then(([powerplant_data, demandData, biomass_svg, coal_svg, geothermal_svg, hydro_svg, natural_gas_svg, nuclear_svg, other_fossil_gasses_svg, other_svg, petroleum_svg, pumped_storage_svg, solar_svg, wind_svg, wood_svg]) => {
	plants = powerplant_data;
	d3.select("#powerplants-selector").attr("disabled", null);

	console.log(demandData);
    // Get a list with all the years from the dataset
    var unique_years = new Set();
	demandData.forEach(d => unique_years.add(d.year));
    var years_list = [...unique_years];

	demand = demandData;

    // enter code to append the year options to the dropdown
    d3.select("#selectButton")
	    .selectAll("option")
	    .data(years_list)
	    .enter()
	    .append("option")
	    .text(d => d)
	    .attr("value", d => d);

    // event listener for the dropdown. Update demand dashboard when selection changes.
    d3.select("#selectButton")
	    .on("change", updateDemandDashboard);

	updateDemandDashboard();
	updateGenerationDashboard();

	images = {
		biomass: biomass_svg.getElementsByTagName("path")[0].getAttribute("d"),
		coal: coal_svg.getElementsByTagName("path")[0].getAttribute("d"),
		geothermal: geothermal_svg.getElementsByTagName("path")[0].getAttribute("d"),
		hydro: hydro_svg.getElementsByTagName("path")[0].getAttribute("d"),
		natural_gas: natural_gas_svg.getElementsByTagName("path")[0].getAttribute("d"),
		nuclear: nuclear_svg.getElementsByTagName("path")[0].getAttribute("d"),
		other_fossil_gasses: other_fossil_gasses_svg.getElementsByTagName("path")[0].getAttribute("d"),
		other: other_svg.getElementsByTagName("path")[0].getAttribute("d"),
		petroleum: petroleum_svg.getElementsByTagName("path")[0].getAttribute("d"),
		pumped_storage: pumped_storage_svg.getElementsByTagName("path")[0].getAttribute("d"),
		solar: solar_svg.getElementsByTagName("path")[0].getAttribute("d"),
		wind: wind_svg.getElementsByTagName("path")[0].getAttribute("d"),
		wood: wood_svg.getElementsByTagName("path")[0].getAttribute("d")
	};
	// display_powerplants();
});

function update_displayed_plants() {
	if (powerplant_toggle.property("checked")) {
		display_powerplants();
	} else {
		hide_powerplants();
	}
}

function display_powerplants() {
	var plants_to_display = get_plants_in_state(state_selected);
	console.log(`Displaying ${plants_to_display.length} plants for state: ${state_selected}`)
	// Get currently displayed plants
	var selection = plant_g.selectAll("path").data(plants_to_display);

	// Drop plants we're not displaying anymore
	selection.exit().remove();

	selection.enter()
		.append("path")
		.on("click", p => {
			d3.event.stopPropagation();
			selected_plant_id = p.id;
			console.log(p);
			set_plant_details_form();
		})
		.on("mouseover", plant_tooltip.show)
		.on("mouseout", plant_tooltip.hide)
		.merge(selection)
		.attr("d", p => images[p.plant_type])
		.attr("transform", d => `translate(${projection([d.lng, d.lat])}) scale(0.5)`);	// TODO: Update translate to center the image at lat long. Currently top-left is at position
}

function hide_powerplants() {
	plant_g.selectAll("path").remove();
}

function updateGenerationDashboard() {
	var plants_to_display = get_plants_in_state(state_selected);
	var total_gen = plants_to_display.reduce((a,b) => a + b.capacity, 0.0);
	var total_renewable = plants_to_display.filter(p => p.is_renewable).reduce((a,b) => a + b.capacity, 0.0);
	var total_nonrenewable = plants_to_display.filter(p => !p.is_renewable).reduce((a,b) => a + b.capacity, 0.0);

	d3.select("#generation_title").text(`Current Energy Generation Capacity (${state_selected})`);
	d3.select("#generation_total").text(`Total Energy Capacity: ${Math.round(total_gen)} MW`);
	d3.select("#generation_renwable").text(`Total from Renewable Sources: ${Math.round(total_renewable)} MW`);
	d3.select("#generation_nonrenewable").text(`Total from Non-Renewable Sources: ${Math.round(total_nonrenewable)} MW`);
}

// Create map function
function createMap(us) {
	usJson = us;

	// Add map
	states = states_g.selectAll("path")
		.data(us.features)
		.enter()
		.append("path")
		.on("click", zoom_state)
		.attr("id", d => d.properties.NAME)
		.attr("d", geoGenerator);

	map_loaded = true;
	map_bounds = geoGenerator.bounds(us);
	reset_zoom(0)

}

function reset_zoom(transition_speed=ZOOM_TRANSITION_SPEED) {
	const [[x1, y1], [x2, y2]] = map_bounds;
	states.classed("selected", false);
	svg.transition()
		.duration(transition_speed)
		.call(map_zoomer.transform, d3.zoomIdentity.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2).scale(1.5).translate((x1 + x2) / -2, (y1 + y2) / -2));
}

// https://observablehq.com/@d3/zoom-to-bounding-box?collection=@d3/d3-zoom
function zoom_state(state, idx, ele) {
	var current_state = d3.select(this);

	// Update state_selected, which will be used to update dashboards
	state_selected = current_state.datum().properties.NAME;

	if (current_state.classed("selected")) {
		reset_zoom();
		state_selected = "United States";
	} else {
		const [[x1, y1], [x2, y2]] = geoGenerator.bounds(state);
		d3.event.stopPropagation();	// Prevent SVG from zooming out
		states.classed("selected", false);				// Clear previous selection
		current_state.classed("selected", true);		// Can highlight state with this
		svg.transition()
			.duration(ZOOM_TRANSITION_SPEED)
			.call(map_zoomer.transform, d3.zoomIdentity
				.translate(SVG_SIZE.WIDTH / 2, SVG_SIZE.HEIGHT / 2)		// Place in center of SVG
				.scale(Math.min(ZOOM_CONSTRAINTS[1], 0.6 / Math.max((x2 - x1) / SVG_SIZE.WIDTH, (y2 - y1) / SVG_SIZE.HEIGHT)))	// Zoom in on state
				.translate((x1 + x2) / -2, (y1 + y2) / -2));	// Now move zoomed in state to center
	}

	update_displayed_plants();
	updateDemandDashboard();
	updateGenerationDashboard();
}

function zoom_map(datum, idx, ele) {
	map_g.attr("transform", d3.event.transform);
	map_g.attr("stroke-width", 1 / d3.event.transform.k);  // Make sure stroke width stays consistent
}

function select_data() {
	if (this.checked) {				// True if user checked it. False if user cleared check.
		load_data(this.value);		// The checkmark clicked
	} else {
		remove_data(this.value);
	}
}

function load_data(data_to_load) {
	svg.classed("loading", true);
	loader.classed("hidden", false);
	filename = DATA_TO_FILENAME[data_to_load];
	d3.json(filename).then(d => {
		var g = map_g.append("g")
			.attr("id", data_to_load + "-data");

			// set input domain for color scale
			set_color_domain(d,data_to_load)

		g.selectAll("path")
			.data(d.features)
			.enter()
			.append("path")
			.style("fill", function(d) {
				//Get data value
				var value = d.properties.capacity_mw;

				if (value) {
					//If value exists…
					return get_color_scale(value,data_to_load);
				} else {
					//If value is undefined…
					return "#ccc";
				}

			})
			.style("stroke", "none")
			.attr("d", geoGenerator);
		data_loaded.push(g);
	}).catch(e => {
		console.log(filename + " not found.\n" + e);
	}).finally(() => {
		svg.classed("loading", false);
		loader.classed("hidden", true);
	});
}

//function to define the different color scales for each drag_new_source_end
function get_color_scale(value,data_to_load){
	if (data_to_load == 'wind'){
		return wind_color(value)
	} else if (data_to_load == 'solar') {
		return solar_color(value)
	} else if (data_to_load == 'geothermal'){
		return geothermal_color(value)
	}
}


function set_color_domain(d,data_to_load){
	if (data_to_load == "wind"){
		 wind_d = wind_color.domain([
		  getMin(d.features,'capacity_mw'),
			getMax(d.features,'capacity_mw')])
		return wind_d
	} else if (data_to_load == "geothermal"){
		return geothermal_color.domain([
			'>15','10-15','5-10','4-5','3-4','2-3','1-2','0.5-1','0.1-0.5','<0.1'
		]);
	}
 else if (data_to_load == "solar"){
	return solar_d = solar_color.domain([
	 getMin(d.features,'capacity_mw'),
	 getMax(d.features,'capacity_mw')])
 return solar_d}
}

function remove_data(data_to_remove) {
	var id = data_to_remove + "-data";
	idx = data_loaded.findIndex(e => e.attr("id") === id);
	if (idx >= 0) {
		d3.select("#" + id).remove();
		data_loaded.splice(idx, 1);
	}
	// console.log(data_loaded);
}

function drag_new_source_start(datum, idx, ele) {
	src = d3.select(this);
	bnds = this.getBoundingClientRect();
	dragdrop_img.attr("src", src.attr("src")).attr("width", bnds.width).attr("height", bnds.height);
	dragdrop_item.datum(src.attr("alt").toLowerCase())
	evtSrc = d3.event.sourceEvent;
	dragdrop_item.style("left", `${evtSrc.clientX - bnds.width/2}px`).style("top", `${evtSrc.clientY - bnds.height/2}px`)
}

function drag_new_source(datum, idx, ele) {
	evtSrc = d3.event.sourceEvent;
	dragdrop_item.style("left", `${evtSrc.clientX - dragdrop_img.attr("width")/2}px`).style("top", `${evtSrc.clientY - dragdrop_img.attr("height")/2}px`)
}

function drag_new_source_end(datum, idx, ele) {
	mouse_to_svg_coords = d3.mouse(map_g.node())
	lat_lng = projection.invert(mouse_to_svg_coords)

	dragdrop_item.style("left", "-100px").style("top", "-100px");
	create_new_plant(lat_lng, dragdrop_item.datum());
}

function create_new_plant(lat_lng, plant_type) {
	var state_selected = get_state_for_lat_lng(lat_lng);
	var new_plant = undefined;
	if (state_selected) {
		new_plant = {
			id: ++next_plant_id,
			lng: lat_lng[0],
			lat: lat_lng[1],
			plant_type: plant_type,
			state: get_state_for_lat_lng(lat_lng),
			capacity: 0,
			sub_plants: {},
			is_renewable: true,				// TODO: Fix this so it's not always true
			name: `New Plant (#${next_plant_id})`
		}

		selected_plant_id = next_plant_id;

		plants.push(new_plant);
		// console.log(new_plant);

		update_displayed_plants();

		// console.log(plants);

		set_plant_details_form();
	} else {
		window.alert("Invalid location for new plant");
	}
	return new_plant;
}

function set_plant_details_form() {
	var current_plant = plants.find(p => p.id == selected_plant_id);
	// console.log(`Looking for id ${selected_plant_id}`);
	// console.log(current_plant);

	plant_lat_input.property("value", current_plant.lat);
	plant_lng_input.property("value", current_plant.lng);
	plant_type_select.property("value", current_plant.plant_type);
	plant_capacity_input.property("value", current_plant.capacity);
}

function update_plant_details() {
	d3.event.preventDefault();

	current_plant = plants.find(p => p.id == selected_plant_id);
	// var current_plant = plants[idx];
	current_plant.lat = parseFloat(plant_lat_input.property("value"));
	current_plant.lng = parseFloat(plant_lng_input.property("value"));
	current_plant.plant_type = plant_type_select.property("value");
	current_plant.capacity = parseFloat(plant_capacity_input.property("value"));
	// console.log(plants);
	update_displayed_plants();
}

function reset_plant_details() {
	d3.event.preventDefault();
	set_plant_details_form();
}

function get_mouse_as_svg_coords() {
	return d3.mouse(map_g.node());
}

function get_lat_lng_for_svg_coords(x_y_pos) {
	return projection.invert(x_y_pos);
}

function get_svg_coords_for_lat_lng(lat_lng) {
	return projection(lat_lng);
}

function get_state_for_mouse_pos() {
	pos = get_mouse_as_svg_coords();
	return get_state_for_position(pos);
}

function get_state_for_position(x_y_pos) {
	lat_lng = get_lat_lng_for_svg_coords(x_y_pos);
	return get_state_for_lat_lng(lat_lng);
}

function get_state_for_lat_lng(lat_lng) {
	for (const state of usJson.features) {
		if (d3.geoContains(state, lat_lng)) {
			return state.properties.NAME;
		}
	}

	return null;
}

function get_plants_in_state(state) {
	return plants.filter(p => (p.state == state) || (state == "United States"))
}
