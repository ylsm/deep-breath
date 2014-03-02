var app = {};
app.helpers = {};
app.data = {};
app.newState = true; // only add new state to history if this is true - needed to make back button work properly
app.range = 15; // km; default range to look for monitoring stations within

app.start = function() {
    app.navigate();
}

app.showHome = function() {
    if (app.newState)
        history.pushState({"view": "home"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Deep Breath</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<button>Enter Location</button>' ).click(function() { app.showSearch(); }));
}

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
}

app.findLocation = function(str, range) {
    // Note: Currently using Google Maps API to find coordinates from given address. Replace with Canadian Open Data when available.
    $.getJSON("http://maps.googleapis.com/maps/api/geocode/json?address=" + str + "&components=country:canada&sensor=false", function(json) {
        if (json.results.length == 1) {
            app.showLocation({"lat": json.results[0].geometry.location.lat, "lng": json.results[0].geometry.location.lng, "address": json.results[0].formatted_address, "range": app.range});
        } else {
            app.showSearchResults(json.results);
        }
    });
}

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
}

app.showLocation = function (obj) {
    if (app.newState)
        history.pushState({"view": "location", "location":obj}, null, null);
    $( '#titlebar' ).empty().append( '<h1>' + obj.address + '</h1>' );
    $( '#content' ).empty();
    var data = app.getAmbientData(obj.lat, obj.lng, obj.range);
    if (!data) {
        $( '#content' ).append("No monitoring stations in range");
    } else {
        var ulAmbient = $( '<ul>' ).appendTo( '#content' );
        ulAmbient.append( '<li>Average FPM: ' + data.fpmAvg + '</li>' );
        ulAmbient.append( '<li>Average Ozone: ' + data.ozoneAvg + '</li>' );
        ulAmbient.append( '<li>Sulphur Dioxide: ' + data.sulphur + '</li>' );
        ulAmbient.append( '<li>Nitrogen Dioxide: ' + data.nitrogen + '</li>' );
        ulAmbient.append( '<li>VOCs: ' + data.voc + '</li>' );
        $( '#content' ).append( '<p>This information is the average of the data from:</p>' );
        var ulStations = $( '<ul>' ).appendTo( '#content' );
        for (var i in data.stations) {
            ulStations.append( '<li>' + data.stations[i].Address + '</li>' );
        }
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
        data.stations = stns;
        data.fpmAvg = [];
        data.fpmPeak = [];
        data.ozoneAvg = [];
        data.ozonePeak = [];
        data.sulphur = [];
        data.nitrogen = [];
        data.voc = [];

        for (var i in stns) {
            data.fpmAvg.push(parseFloat(stns[i]['2011 Average Fine Particulate Matter (µg/m3)']));
            data.fpmPeak.push(parseFloat(stns[i]['2011 Peak Fine Particulate Matter (µg/m3)']));
            data.ozoneAvg.push(parseFloat(stns[i]['2011 Average Ozone (ppb)']));
            data.ozonePeak.push(parseFloat(stns[i]['2011 Peak Ozone (ppb)']));
            data.sulphur.push(parseFloat(stns[i]['2011 Sulphur Dioxide (ppb)']));
            data.nitrogen.push(parseFloat(stns[i]['2011 Nitrogen Dioxide (ppb)']));
            data.voc.push(parseFloat(stns[i]['2011 Volatile Organic Compounds (ppbC)']));
        }
        data.fpmAvg = app.helpers.average(data.fpmAvg);
        data.fpmPeak = app.helpers.average(data.fpmPeak);
        data.ozoneAvg = app.helpers.average(data.ozoneAvg);
        data.ozonePeak = app.helpers.average(data.ozonePeak);
        data.sulphur = app.helpers.average(data.sulphur);
        data.nitrogen = app.helpers.average(data.nitrogen);
        data.voc = app.helpers.average(data.voc);
        
        return data;
    }

    return false;
}

app.helpers.average = function (values) {
    var totalNum = values.length;
    var total = 0;
    for (var i in values) {
        if (values[i] >= 0) { // data stores unavailable numbers as -99
            total += values[i];
        } else {
            totalNum -= 1;
        }
    }
    if (totalNum > 0)
        return (total / totalNum);
    return "No Data";
}

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
}

app.navigate = function (view) {
    switch(view) {
        case "":
            app.showHome();
            break;
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
    }
}

window.addEventListener('popstate', function(e) {
    var view = '';
    if (e.state)
        view = e.state.view;
    app.newState = false;
    app.navigate(view);
    app.newState = true;
});

$(function() {
    $.get('data/ambient.csv', function(data) {
        app.data.ambient = $.csv.toObjects(data, {"separator":"\t"});
        app.start();
    });
});