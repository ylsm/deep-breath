var app = {};
app.helpers = {};
app.data = {};
app.newState = true;

app.start = function() {
    app.navigate();
}

app.showHome = function() {
    if (app.newState)
        history.pushState(null, null, "home");
    $( '#titlebar' ).empty().append( '<h1>Deep Breath</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<button>Enter Location</button>' ).click(function() { app.showSearch(); }));
}

app.showSearch = function() {
    if (app.newState)
        history.pushState(null, null, "search");
    $( '#titlebar' ).empty().append( '<h1>Enter Location</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<input type="text" id="location"></input>' ));
    $( '#content' ).append($( '<button>Go</button>' ).click(function() { app.parseLocation($( '#location' ).val()); }));
}

app.parseLocation = function(str) {
    // Note: Currently using Google Maps API to find coordinates from given address. Replace with Canadian Open Data when available.
    $.getJSON("http://maps.googleapis.com/maps/api/geocode/json?address=" + str + "&components=country:canada&sensor=false", function(json) {
        if (json.results.length == 1) {
            app.showLocation({"lat": json.results[0].geometry.location.lat, "lng": json.results[0].geometry.location.lng, "address": json.results[0].formatted_address});
        } else {
            app.showSearchResults(json.results);
        }
    });
}

app.showSearchResults = function (obj) {
    if (app.newState)
        history.pushState({"locations":obj}, null, "results");
    $( '#titlebar' ).empty().append( '<h1>Did you mean...</h1>' );
    $( '#content' ).empty();
    var ul = $( '<ul>' ).appendTo( '#content' );
    for (var i in obj) {
        ul.append($( '<li>' + obj[i].formatted_address + '</li>' ).click((function(data) {
            return function() { app.showLocation(data); };
        })({"lat":obj[i].geometry.location.lat, "lng":obj[i].geometry.location.lng, "address":obj[i].formatted_address})));
    }
}

app.showLocation = function (obj) {
    if (app.newState)
        history.pushState({"location":obj}, null, "location");
    $( '#titlebar' ).empty().append( '<h1>' + obj.address + '</h1>' );
    $( '#content' ).empty();
    var data = app.getAirQualityData(obj.lat, obj.lng);
    if (!data) {
        $( '#content' ).append("No monitoring stations in range");
    } else {
        var ul = $( '<ul>' ).appendTo( '#content' );
        ul.append( '<li>Average FPM: ' + data.fpmAvg + '</li>' );
        ul.append( '<li>Average Ozone: ' + data.ozoneAvg + '</li>' );
        ul.append( '<li>Sulphur Dioxide: ' + data.sulphur + '</li>' );
        ul.append( '<li>Nitrogen Dioxide: ' + data.nitrogen + '</li>' );
        ul.append( '<li>VOCs: ' + data.voc + '</li>' );
    }
}

app.getAirQualityData = function (lat, lng) {
    var stns = [];
    for (var i in app.data.airQuality) {
        var stn = app.data.airQuality[i];
        if (Math.sqrt(Math.pow((lat - stn.Latitude), 2) + Math.pow((lng - stn.Longitude, 2))) <= 10) {
            stns.push(stn);
        }
    }
    
    if (stns.length > 0) {
        var data = {};
        data.stations = stns;
        data.fpmAvg = 0;
        data.fpmPeak = 0;
        data.ozoneAvg = 0;
        data.ozonePeak = 0;
        data.sulphur = 0;
        data.nitrogen = 0;
        data.voc = 0;

        for (var i in stns) {
            data.fpmAvg += stns[i]['2011 Average Fine Particulate Matter (µg/m3)'];
            data.fpmPeak += stns[i]['2011 Peak Fine Particulate Matter (µg/m3)'];
            data.ozoneAvg += stns[i]['2011 Average Ozone (ppb)'];
            data.ozonePeak += stns[i]['2011 Peak Ozone (ppb)'];
            data.sulphur += stns[i]['2011 Sulphur Dioxide (ppb)'];
            data.nitrogen += stns[i]['2011 Nitrogen Dioxide (ppb)'];
            data.voc += stns[i]['2011 Volatile Organic Compounds (ppbC)'];
        }
        data.fpmAvg /= stns.length;
        data.fpmPeak /= stns.length;
        data.ozoneAvg /= stns.length;
        data.ozonePeak /= stns.length;
        data.sulphur /= stns.length;
        data.nitrogen /= stns.length;
        data.voc /= stns.length;
        
        return data;
    }

    return false;
}

app.helpers.getPageName = function () {
    return window.location.pathname.split("/").pop();
}

app.navigate = function () {
    switch(app.helpers.getPageName()) {
        case "index.html":
            app.showHome();
            break;
        case "deep-breath":
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
    app.newState = false;
    app.navigate();
    app.newState = true;
});

$(function() {
    $.get('air_quality.csv', function(data) {
        app.data.airQuality = $.csv.toObjects(data, {"separator":"\t"});
        app.start();
    });
});