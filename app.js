var app = {};
app.helpers = {}; // helper functions
app.data = {};
app.loading = {"files": 3, "loaded": 0};
app.newState = true; // only add new state to history if this is true - needed to make back button work properly
app.range = 15; // km; default range to look for monitoring stations within
app.IGNORE = -99; // value meaning "no data" in CSV files

// Calculate relative levels of pollutants for display
app.levels = {"ambient":{}, "pollutants":{}, "toxics":{}};
app.levels.ambient.fpmAvg = [0, 4, 6, 8, 10];
app.levels.ambient.fpmPeak = [0, 10, 15, 20, 28];
app.levels.ambient.o3Avg = [0, 30, 35, 40, 45];
app.levels.ambient.o3Peak = [0, 50, 55, 60, 63];
app.levels.ambient.so2 = [0, 0.5, 1, 2, 4];
app.levels.ambient.no2 = [0, 4, 8, 12, 16];
app.levels.ambient.voc = [0, 20, 40, 60, 100];
app.levels.pollutants.nox = [0, 50, 100, 200, 400, 800];
app.levels.pollutants.sox = [0, 25, 100, 500, 2000, 6000];
app.levels.pollutants.voc = [0, 15, 30, 100, 200, 400];
app.levels.pollutants.pm25 = [0, 0.5, 1, 5, 25, 100];
app.levels.pollutants.pm10 = [0, 1, 5, 10, 50, 250];
app.levels.pollutants.tpm = [0, 5, 25, 100, 250, 1000];
app.levels.pollutants.nh3 = [0, 1, 5, 25, 100, 400];
app.levels.pollutants.co = [0, 25, 50, 100, 500, 1000];
app.levels.toxics.hg = [0, 0.5, 5, 25, 50, 100];
app.levels.toxics.crvi = [0, 0.1, 1, 5, 25, 50];

// from http://www.barattalo.it/2009/12/26/decimal-degrees-conversion-and-distance-of-two-points-on-google-map/
app.helpers.getDistance = function (lat1,lon1,lat2,lon2) {
    var R = 6371; // km (change this constant to get miles)
    var dLat = (lat2-lat1) * Math.PI / 180;
    var dLon = (lon2-lon1) * Math.PI / 180; 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180 ) * Math.cos(lat2 * Math.PI / 180 ) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
};

// from http://www.movable-type.co.uk/scripts/latlong.html
app.helpers.getDestinationPoint = function (lat, lon, brngD, d) {
    var lat1 = lat * Math.PI / 180;
    var lon1 = lon * Math.PI / 180;
    var brng = brngD * Math.PI / 180;
    var R = 6371; // km (change this constant to get miles)
    var lat2 = Math.asin( Math.sin(lat1)*Math.cos(d/R) + 
                                  Math.cos(lat1)*Math.sin(d/R)*Math.cos(brng) );
    var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(d/R)*Math.cos(lat1), 
                                         Math.cos(d/R)-Math.sin(lat1)*Math.sin(lat2)); 
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
};

app.helpers.average = function (values) {
    var totalNum = values.length;
    var total = 0;
    for (var i in values) {
        if (parseFloat(values[i]) != app.IGNORE) { // if it's not an ignore value
            total += parseFloat(values[i]);
        } else {
            totalNum -= 1;
        }
    }

    if (totalNum > 0)
        return Math.round(total / totalNum * 100) / 100;
    return 0;
};

app.helpers.total = function (values) {
    var total = 0;
    for (var i in values) {
        if (parseFloat(values[i]) != app.IGNORE)
            total += parseFloat(values[i]);
    }
    return total;
};

app.helpers.getLevel = function (cat, type, value) {
    if (value == 'No Data' || value == app.IGNORE)
        return 0;
    for (var i = 0; i < app.levels[cat][type].length; i++) {
            if (parseFloat(value) < app.levels[cat][type][i]) {
                return i;
            }
        }
    return app.levels[cat][type].length;
}

app.helpers.makeLi = function (cat, type, text, value) {
    var level;
    if (parseFloat(value) == 0 || parseFloat(value) == app.IGNORE) {
        return null;
    } else {
        level = app.helpers.getLevel(cat, type, value);
    }
    return $( '<li class="' + cat + ' level-' + level + '">' + text + ': ' + value + '</li>' );
};

app.helpers.getRadius = function (type, place) {
    var values = [];
    switch (type) {
        case "ambient":
            var chems = ["fpmAvg", "o3Avg", "so2", "no2", "voc"];
            for (var i in chems) {
                values.push(app.helpers.getLevel(type, chems[i], place[chems[i]]));
            }
            console.log(values);
            return app.helpers.average(values);
        case "pollutants":
            var chems = ["nox", "sox", "voc", "pm25", "pm10"];
            for (var i in chems) {
                values.push(app.helpers.getLevel(type, chems[i], place[chems[i]]));
            }
            console.log(values);
            return app.helpers.average(values);
        case "toxics":
            return app.helpers.average([place.hg, place.crvi]);
    }
}

app.getAmbientData = function (lat, lng, range) {
    var stns = [];
    for (var i in app.data.ambient) {
        var stn = app.data.ambient[i];
        if (app.helpers.getDistance(lat, lng, stn.Latitude, stn.Longitude) <= range) {
            stns.push(stn);
        }
    }
    
    if (stns.length > 0) {
        var data = {};
        data.stations = [];
        data.fpmAvg = [];
        data.fpmPeak = [];
        data.o3Avg = [];
        data.o3Peak = [];
        data.so2 = [];
        data.no2 = [];
        data.voc = [];

        for (var i in stns) {
            var obj = {};
            obj.name = stns[i]['Address'];
            obj.lat = stns[i]['Latitude'];
            obj.lng = stns[i]['Longitude'];
            obj.fpmAvg = parseFloat(stns[i]['2011 Average Fine Particulate Matter (µg/m3)']);
            obj.fpmPeak = parseFloat(stns[i]['2011 Peak Fine Particulate Matter (µg/m3)']);
            obj.o3Avg = parseFloat(stns[i]['2011 Average Ozone (ppb)']);
            obj.o3Peak = parseFloat(stns[i]['2011 Peak Ozone (ppb)']);
            obj.so2 = parseFloat(stns[i]['2011 Sulphur Dioxide (ppb)']);
            obj.no2 = parseFloat(stns[i]['2011 Nitrogen Dioxide (ppb)']);
            obj.voc = parseFloat(stns[i]['2011 Volatile Organic Compounds (ppbC)']);
            data.stations.push(obj);

            data.fpmAvg.push(obj.fpmAvg);
            data.fpmPeak.push(obj.fpmPeak);
            data.o3Avg.push(obj.o3Avg);
            data.o3Peak.push(obj.o3Peak);
            data.so2.push(obj.so2);
            data.no2.push(obj.no2);
            data.voc.push(obj.voc);
        }
        data.fpmAvg = app.helpers.average(data.fpmAvg);
        data.fpmPeak = app.helpers.average(data.fpmPeak);
        data.o3Avg = app.helpers.average(data.o3Avg);
        data.o3Peak = app.helpers.average(data.o3Peak);
        data.so2 = app.helpers.average(data.so2);
        data.no2 = app.helpers.average(data.no2);
        data.voc = app.helpers.average(data.voc);
        
        return data;
    }

    return false;
};



app.getEmissionsPollutantsData = function (lat, lng, range) {
    var facilities = [];
    for (var i in app.data.pollutants) {
        var facility = app.data.pollutants[i];
        if (app.helpers.getDistance(lat, lng, facility.Latitude, facility.Longitude) <= range) {
            facilities.push(facility);
        }
    }
    
    if (facilities.length > 0) {
        var data = {};
        data.facilities = [];
        data.nox = [];
        data.sox = [];
        data.voc = [];
        data.pm25 = [];
        data.pm10 = [];
        data.tpm = [];
        data.nh3 = [];
        data.co = [];
        for (var i in facilities) {
            var obj = {};
            obj.name = facilities[i]['Facility Name'];
            obj.company = facilities[i]['Company Name'];
            obj.naics = facilities[i]['NAICS Name'];
            obj.lat = facilities[i]['Latitude'];
            obj.lng = facilities[i]['Longitude'];
            obj.nox = facilities[i]['2011 NOx Emissions (t)'];
            obj.sox = facilities[i]['2011 SOx Emissions (t)'];
            obj.voc = facilities[i]['2011 VOC Emissions (t)'];
            obj.pm25 = facilities[i]['2011 PM2.5 Emissions (t)'];
            obj.pm10 = facilities[i]['2011 PM10 Emissions (t)'];
            obj.tpm = facilities[i]['2011 VOC Emissions (t)'];
            obj.nh3 = facilities[i]['2011 NH3 Emissions (t)'];
            obj.co = facilities[i]['2011 CO Emissions (t)'];
            data.facilities.push(obj);
            
            data.nox.push(obj.nox);
            data.sox.push(obj.sox);
            data.voc.push(obj.voc);
            data.pm25.push(obj.pm25);
            data.pm10.push(obj.pm10);
            data.tpm.push(obj.tpm);
            data.nh3.push(obj.nh3);
            data.co.push(obj.co);
        }
        data.nox = app.helpers.total(data.nox);
        data.sox = app.helpers.total(data.sox);
        data.voc = app.helpers.total(data.voc);
        data.pm25 = app.helpers.total(data.pm25);
        data.pm10 = app.helpers.total(data.pm10);
        data.tpm = app.helpers.total(data.tpm);
        data.nh3 = app.helpers.total(data.nh3);
        data.co = app.helpers.total(data.co);
        return data;
    }
    return false;
};

app.getEmissionsToxicsData = function (lat, lng, range) {
    var facilities = [];
    for (var i in app.data.toxics) {
        var facility = app.data.toxics[i];
        if (app.helpers.getDistance(lat, lng, facility.Latitude, facility.Longitude) <= range) {
            facilities.push(facility);
        }
    }

    if (facilities.length > 0) {
        var data = {};
        data.facilities = [];
        data.hg = [];
        data.crvi = [];
        for (var i in facilities) {
            var obj = {};
            obj.name = facilities[i]['Facility Name'];
            obj.company = facilities[i]['Company Name'];
            obj.naics = facilities[i]['NAICS Name'];
            obj.lat = facilities[i]['Latitude'];
            obj.lng = facilities[i]['Longitude'];
            obj.hg = facilities[i]['2011 Hg Emissions (kg)'];
            obj.crvi = facilities[i]['2011 Cr(VI) Emissions (kg)'];
            data.facilities.push(obj);
            
            data.hg.push(obj.hg);
            data.crvi.push(obj.crvi);
        }
        data.hg = app.helpers.total(data.hg);
        data.crvi = app.helpers.total(data.crvi);
        return data;
    }
    return false;
};

app.start = function() {
    app.navigate("home");
};

app.showHome = function() {
    if (app.newState)
        history.pushState({"view": "home"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Deep Breath</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<button>Enter Location</button>' ).click(function() { app.showSearch(); }));
};

app.showSearch = function() {
    if (app.newState)
        history.pushState({"view": "search"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Enter Location</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<input type="text" id="location"></input>' ));
    $( '#content' ).append($( '<input type="text" id="range" value="' + app.range + '"></input>' ));
    $( '#content' ).append($( '<button>Go</button>' ).click(function() {
            app.findLocation($( '#location' ).val());
            app.range = parseFloat($( '#range' ).val());
        }));
};

app.findLocation = function(str, range) {
    // Note: Currently using Google Maps API to find coordinates from given address. Replace with Canadian Open Data when available.
    // There is an API limit of 2500 calls per IP address.
    $.getJSON("http://maps.googleapis.com/maps/api/geocode/json?address=" + str + "&components=country:canada&sensor=false", function(json) {
        if (json.results.length == 1) {
            app.showLocation({"lat": json.results[0].geometry.location.lat, "lng": json.results[0].geometry.location.lng, "address": json.results[0].formatted_address, "range": app.range});
        } else {
            app.showSearchResults(json.results);
        }
    });
};

app.showSearchResults = function (obj) {
    if (app.newState)
        history.pushState({"view": "results", "locations":obj}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Did you mean...</h1>' );
    $( '#content' ).empty();
    var ul = $( '<ul>' ).appendTo( '#content' );
    for (var i in obj) {
        ul.append($( '<li>' + obj[i].formatted_address + '</li>' ).click((function(data) {
            return function() { app.showLocation(data); };
        })({"lat":obj[i].geometry.location.lat, "lng":obj[i].geometry.location.lng, "address":obj[i].formatted_address, "range": app.range})));
    }
};

app.showLocation = function (obj) {
    if (app.newState)
        history.pushState({"view": "location", "location":obj}, null, null);
    $( '#titlebar' ).empty().append( '<h1>' + obj.address + '</h1>' );
    $( '#content' ).empty();

    $( '#content' ).append('<h2>Ambient Pollutant Levels</h2>');
    var dataAmbient = app.getAmbientData(obj.lat, obj.lng, obj.range);
    if (!dataAmbient) {
        $( '#content' ).append("No monitoring stations in range");
    } else {
        $( '#content' ).append( $( '<button>View Map</button>').click((function (lat, lng, data) {
            return function() {app.showMap(lat, lng, "ambient", data)};
        })(obj.lat, obj.lng, dataAmbient.stations)));
        var ulAmbient = $( '<ul>' ).appendTo( '#content' );
        ulAmbient.append(app.helpers.makeLi("ambient", "fpmAvg", "Average FPM", dataAmbient.fpmAvg));
        ulAmbient.append(app.helpers.makeLi("ambient", "o3Avg", "Average Ozone", dataAmbient.o3Avg));
        ulAmbient.append(app.helpers.makeLi("ambient", "so2", "Sulphur Dioxide", dataAmbient.so2));
        ulAmbient.append(app.helpers.makeLi("ambient", "no2", "Nitrogen Dioxide", dataAmbient.no2));
        ulAmbient.append(app.helpers.makeLi("ambient", "voc", "VOCs", dataAmbient.voc));
        $( '#content' ).append( '<h3>Monitoring Stations:</h3>' );
        var ulStations = $( '<ul>' ).appendTo( '#content' );
        for (var i in dataAmbient.stations) {
            ulStations.append( '<li>' + dataAmbient.stations[i].name + '</li>' );
        }
        
    }

    $( '#content' ).append('<h2>Large Emissions (Pollutants)</h2>');
    var dataPollutants = app.getEmissionsPollutantsData(obj.lat, obj.lng, obj.range);
    if (!dataPollutants) {
        $( '#content' ).append("No large emitters of pollutants in range");
    } else {
        $( '#content' ).append( $( '<button>View Map</button>').click((function (lat, lng, data) {
            return function() {app.showMap(lat, lng, "pollutants", data)};
        })(obj.lat, obj.lng, dataPollutants.facilities)));
        var ulPollutants = $( '<ul>' ).appendTo( '#content' );
        ulPollutants.append(app.helpers.makeLi("pollutants", "nox", "Total NOx Emissions", dataPollutants.nox));
        ulPollutants.append(app.helpers.makeLi("pollutants", "sox", "Total SOx Emissions", dataPollutants.sox));
        ulPollutants.append(app.helpers.makeLi("pollutants", "voc", "Total VOC Emissions", dataPollutants.voc));
        ulPollutants.append(app.helpers.makeLi("pollutants", "pm25", "Total PM2.5 Emissions", dataPollutants.pm25));
        ulPollutants.append(app.helpers.makeLi("pollutants", "pm10", "Total PM10 Emissions", dataPollutants.pm10));
        ulPollutants.append(app.helpers.makeLi("pollutants", "tpm", "Total TPM Emissions", dataPollutants.tpm));
        ulPollutants.append(app.helpers.makeLi("pollutants", "co", "Total CO Emissions", dataPollutants.co));
    }

    $( '#content' ).append('<h2>Large Emissions (Toxics)</h2>');
    var dataToxics = app.getEmissionsToxicsData(obj.lat, obj.lng, obj.range);
    if (!dataToxics) {
        $( '#content' ).append("No large emitters of toxics in range");
    } else {
        $( '#content' ).append( $( '<button>View Map</button>').click((function (lat, lng, data) {
            return function() {app.showMap(lat, lng, "ambient", data)};
        })(obj.lat, obj.lng, dataToxics.facilities)));
        var ulToxics = $( '<ul>' ).appendTo( '#content' );
        ulToxics.append(app.helpers.makeLi("toxics", "hg", "Total Mercury Emissions (kg)", dataToxicx.hg));
        ulToxics.append(app.helpers.makeLi("toxics", "crvi", "Total Hexavalent Chromium Emissions (kg)", dataToxicx.crvi));
    }
};

app.showMap = function (lat, lng, type, locations) {
    if (app.newState)
        history.pushState({"view": "map", "lat":lat, "lng":lng, "type":type, "locations":locations}, null, null);

    $( '#titlebar' ).empty().append('<h1>Map</h1>');
    $( '#content' ).empty();
    
    $( '#content' ).append( '<div id="map"></div>' );

    var map = L.map('map').setView([lat, lng], 8);
    map.fitBounds([app.helpers.getDestinationPoint(lat, lng, 225, app.range + 2), app.helpers.getDestinationPoint(lat, lng, 45, app.range + 2)]);
    new L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {minZoom:1, maxZoom: 12,   attribution: 'Map data © OpenStreetMap contributors'}).addTo(map);

    var markers = new L.LayerGroup();
    for (var i in locations) {
        var marker = L.marker([locations[i].lat, locations[i].lng]);
        marker.bindPopup(locations[i].name);
        markers.addLayer(marker);
        L.circle([locations[i].lat, locations[i].lng], app.helpers.getRadius(type, locations[i]) * 1000, {color: 'red', fillColor: '#f03', fillOpacity: 0.5}).addTo(map);
    }
    markers.addTo(map);
};

app.navigate = function (view) {
    switch(view) {
        case "home":
            app.showHome();
            break;
        case "search":
            app.showSearch();
            break;
        case "results":
            app.showSearchResults(event.state.locations);
            break;
        case "location":
            app.showLocation(event.state.location);
            break;
        case "map":
            app.showMap(event.state.lat, event.state.lng, event.state.type, event.state.locations);
            break;
    }
};

app.loading.checkAllDataLoaded = function () {
    if (app.loading.loaded == app.loading.files)
        app.start();
};

window.addEventListener('popstate', function(e) {
    var view = "home";
    if (e.state)
        view = e.state.view;
    app.newState = false;
    app.navigate(view);
    app.newState = true;
});

$(function() {
    $.get('data/ambient.csv', function(data) {
        app.data.ambient = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
    $.get('data/emissions_pollutants.csv', function(data) {
        app.data.pollutants = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
    $.get('data/emissions_toxics.csv', function(data) {
        app.data.toxics = $.csv.toObjects(data, {"separator":"\t"});
        app.loading.loaded += 1;
    });
});