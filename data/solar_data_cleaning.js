// Data provides average annual and monthly solar attributes from 1998-2009
// https://developer.nrel.gov/docs/solar/solar-resource-v1/
// https://developer.nrel.gov/docs/solar/nsrdb/guide/ - limit for API calls is 1000 requests per day, 1 request every 2 seconds

// Define API key for API call
const API_KEY = 'Ry9c6ppp6yscix0FfTSDauhlMEMf52uwCoQY2pip';

// Extract lat/lon values from wind for solar API call
d3.csv("Wind_lat_long.csv", function(d) {
    return {
        lat: d.latitude,
        lon: d.longitude
    };
}).then(function(coords) {

    //console.log(coords);

    const promises = [];

    for (let i = 0; i < coords.length; i++) {
      const { lat, lon } = coords[i];
      const url = `https://developer.nrel.gov/api/solar/solar_resource/v1.json?api_key=${API_KEY}&lat=${lat}&lon=-${lon}`;
      const promise = fetch(url).then(res => res.json()); // we will need to clean/format the data

      promises.push(promise);
    }


    Promise.all(promises).then(responses => {

        console.log(responses); // responses is an array of promise results

        // load_data(responses) // Call function to load data for mapping

    });


});
