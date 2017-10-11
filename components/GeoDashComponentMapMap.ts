declare var extract: any;
declare var geodash: any;
declare var ol: any;
declare var jsts: any;
declare var $: any;

/* Components */
import { Component, OnInit, AfterContentInit, AfterViewInit, EventEmitter, ElementRef, ChangeDetectorRef, Input } from '@angular/core';

/* Services */
import { GeoDashServiceBus }  from 'GeoDashServiceBus';
import { GeoDashServiceCompile } from 'GeoDashServiceCompile';

@Component({
  selector: 'geodash-map-map',
  template: geodash.api.getTemplate('geodashMapMap.tpl.html')
})
export class GeoDashComponentMapMap implements OnInit, AfterContentInit, AfterViewInit {
  name = 'GeoDashComponentMapMap';

  private dashboard: any;
  private state: any;

  @Input() mapId: string;

  constructor(private element: ElementRef, private changeDetector: ChangeDetectorRef, private bus: GeoDashServiceBus, private compileService: GeoDashServiceCompile) {

  }

  ngOnInit(): void {

  }

  ngAfterContentInit(): void {
    geodash.var.components[this.name+"-"+this.mapId] = this; // register externally
  }

  ngAfterViewInit(): void {
    // geodash:loaded was already fired, otherwise this component wouldn't exist.
    // Initialize Now!
    //this.bus.listen("primary", "geodash:loaded", this.onLoaded);
    if(geodash.util.isDefined(geodash.var.dashboard))
    {
      this.onLoaded()
    }
    else
    {
      this.bus.listen("primary", "geodash:loaded", this.onLoaded);
    }
  }

  render = (object: any, ctx: any): any => {
    return geodash.util.arrayToObject(geodash.util.objectToArray(object).map((x:any) => {
      return <any>{
        "name": x.name,
        "value": (geodash.util.isString(x.value) ? this.interpolate(x.value)(ctx) : x.value)
      };
    }));
  }

  interpolate = (template: string): any => {
      return (ctx:any) => this.compileService.compile(template, ctx);
  }

  bootstrap = (): void => {
    this.dashboard = geodash.var.dashboard();
    this.state = geodash.var.state();

    // Initialize Map
    var listeners = <any>{
      "map": <any>{
        singleclick: this.onMapSingleClick,
        movestart: this.onMapMoveStart,
        moveend: this.onMapMoveEnd,
        postrender: this.onMapPostRender
      },
    };
    geodash.var.map = geodash.init.map_ol3(<any>{
      "id": this.mapId,
      "dashboard": this.dashboard,
      "state": this.state,
      "listeners": listeners
    });

    geodash.var.getZoom = () => geodash.var.map.getView().getZoom();

    // Initialize JSTS
    if(typeof jsts != "undefined")
    {
      if(! geodash.util.isDefined(geodash.var.jsts_parser))
      {
        geodash.var.jsts_parser = new jsts.io.OL3Parser();
      }
    }

    // Baselayers
    if(extract("baselayers", this.dashboard, []).length > 0)
    {
      var baselayers = geodash.layers.init_baselayers_ol3(geodash.var.map, this.dashboard.baselayers);
      geodash.util.extend(geodash.var.baselayers, baselayers);
      // Load Default/Initial Base Layer
      var baseLayerID = this.dashboard.view.baselayer || this.dashboard.baselayers[0].id;
      geodash.var.map.addLayer(geodash.var.baselayers[baseLayerID]);
      //geodash.api.intend("viewChanged", {'baselayer': baseLayerID}, $scope);
      //geodash.api.intend("layerLoaded", {'type':'baselayer', 'layer': baseLayerID}, $scope);
    }

    // Feature Layers
    if(Array.isArray(extract("featurelayers", this.dashboard)))
    {
      for(var i = 0; i < this.dashboard.featurelayers.length; i++)
      {
        var fl = this.dashboard.featurelayers[i];
        //geodash.layers.init_featurelayer(fl.id, fl, $scope, live, dashboard, state);
        geodash.layers.init_featurelayer({
          "id": fl.id,
          "fl": fl,
          "dashboard":this.dashboard,
          "state": this.state
        });
      }
    }

    this.bus.emit("primary", "geodash:maploaded", <any>{}, this.name);

  }

  onLoaded = (): void => {
    this.bus.listen("render", "geodash:detectChanges", this.onDetectChanges);
    this.bus.listen("render", "geodash:refresh", this.onRefresh);
    this.bus.listen("render", "geodash:changeView", this.onChangeView);
    this.bus.listen("render", "geodash:openPopup", this.onOpenPopup);
    this.bus.listen("render", "geodash:addFeatureLayers", this.onAddFeatureLayers);
    this.bus.listen("render", "geodash:upsertFeatureLayers", this.onUpsertFeatureLayers);
    this.bus.listen("render", "geodash:removeBaseLayers", this.onRemoveBaseLayers);
    this.bus.listen("render", "geodash:removeFeatureLayers", this.onRemoveFeatureLayers);
    this.bus.listen("render", "geodash:replaceFeatures", this.onReplaceFeatures);

    this.bootstrap();
  }

  onMapSingleClick = (e: any): void => {
    var m = geodash.var.map;
    var v = m.getView();
    var c = ol.proj.toLonLat(e.coordinate, v.getProjection());
    var data = <any>{
      "location": <any>{
        "lat": c[1],
        "lon": c[0]
      },
      "pixel": <any>{
        "x": e.pixel[0],
        "y": e.pixel[1]
      }
    };
    this.bus.emit("intents", "clickedOnMap", data, this.name);
  }

  onMapMoveStart = (e: any): void => {

    if(! geodash.var.map.getView().getAnimating())
    {
      console.log("In movestart, going to trigger moveStart.");
      var m = geodash.var.map;
      var v = m.getView();
      var c = v.getCenter();
      var extent = geodash.normalize.extent(v.calculateExtent(m.getSize()), {
        sourceProjection: v.getProjection(),
        targetProjection: "EPSG:4326"
      });
      var lonlat = ol.proj.transform(c, v.getProjection(), "EPSG:4326");
      var data = <any>{
        "extent": extent,
        "lon": lonlat[0],
        "lat": lonlat[1]
      };
      this.bus.emit("journal", "moveStart", data, this.name);
    }

  }

  onMapMoveEnd = (e: any): void => {

    if(! geodash.var.map.getView().getAnimating())
    {
      console.log("In moveend, going to trigger viewChanged.");
      var m = geodash.var.map;
      var v = m.getView();
      var c = v.getCenter();
      var extent = geodash.normalize.extent(v.calculateExtent(m.getSize()), {
        sourceProjection: v.getProjection(),
        targetProjection: "EPSG:4326"
      });
      var lonlat = ol.proj.transform(c, v.getProjection(), "EPSG:4326");
      var data = <any>{
        "extent": extent,
        "lon": lonlat[0],
        "lat": lonlat[1]
      };
      this.bus.emit("journal", "viewChanged", data, this.name);
    }

  }

  onMapPostRender = (e: any): void => {
    var popover = $("#popup").data("bs.popover");
    if(geodash.util.isDefined(popover))
    {
      var tether = popover._tether;
      if(geodash.util.isDefined(tether))
      {
        tether.position()
      }
    }
  }

  onRefresh = (name: any, data: any, source: any): void => {

    if(geodash.util.isDefined(extract("dashboard", data)))
    {
      this.dashboard = data["dashboard"];
    }

    if(geodash.util.isDefined(extract("state", data)))
    {
      this.state = data["state"];
    }

    var visibleBaseLayer = this.state.view.baselayer;
    var currentLayers = geodash.mapping_library == "ol3" ? geodash.var.map.getLayers().getArray() : undefined;
    geodash.util.objectToArray(geodash.var.baselayers).forEach((x:any) => {
      let layer = x.value;
      var visible = x.name == visibleBaseLayer;
      if(geodash.mapping_library == "leaflet")
      {
        if(geodash.var.map.getLayers().getArray().indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(geodash.var.map.getLayers().getArray().indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
      else
      {
        if(currentLayers.indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(currentLayers.indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
    });

    var visibleFeatureLayers = this.state.view.featurelayers;
    geodash.util.objectToArray(geodash.var.featurelayers).forEach((x:any) => {
      var layer = x.value
      var visible = visibleFeatureLayers.indexOf(x.name) != -1;
      if(geodash.mapping_library == "leaflet")
      {
        if(geodash.var.map.getLayers().getArray().indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(geodash.var.map.getLayers().getArray().indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
      else
      {
        if(currentLayers.indexOf(layer) != -1 && !visible)
        {
          geodash.var.map.removeLayer(layer);
        }
        else if(currentLayers.indexOf(layer) == -1 && visible)
        {
          geodash.var.map.addLayer(layer);
        }
      }
    });

    // Update Render Order
    var renderLayers = geodash.util.objectToArray(geodash.var.featurelayers).filter((x:any) => visibleFeatureLayers.indexOf(x["name"]) != -1);
    //var renderLayers = $.grep(layersAsArray(geodash.var.featurelayers), function(layer){ return $.inArray(layer["id"], visibleFeatureLayers) != -1;});
    //var renderLayersSorted = sortLayers(renderLayers.map((layer:any) => layer["layer"]}), true);
    //var baseLayersAsArray = geodash.util.objectToArray(geodash.var.baselayers).map((x:any) => {'id':x.name, 'layer': x.value});
    //var baseLayersAsArray = $.map(geodash.var.baselayers, function(layer, id){return {'id':id,'layer':layer};});
    /*var baseLayers = $.map(
      $.grep(layersAsArray(geodash.var.baselayers), function(layer){return layer["id"] == visibleBaseLayer;}),
      function(layer, i){return layer["layer"];});*/

    // Force Refresh
    if(geodash.mapping_library == "ol3")
    {
      setTimeout(function(){

        var m = geodash.var.map;
        m.renderer_.dispose();
        m.renderer_ = new ol.renderer.canvas.Map(m.viewport_, m);
        //m.updateSize();
        m.renderSync();

      }, 0);
    }
    else if(geodash.mapping_library == "leaflet")
    {
      for(var i = 0; i < renderLayers.length; i++)
      {
          renderLayers[i].bringToFront();
      }

      setTimeout(function(){ geodash.var.map._onResize(); }, 0);
    }
  }

  onDetectChanges = (name: any, data: any, source: any): void => {
    this.changeDetector.detectChanges();
    setTimeout(function(){ geodash.var.map.updateSize(); }, 0);
  }

  onChangeView = (name: any, data: any, source: any): void => {
    console.log("Changing view...");
    if(geodash.util.isDefined(extract("rotation", data)))
    {
      geodash.var.map.getView().setRotation(extract("rotation", data));
    }
    if(geodash.util.isDefined(extract("layer", data)))
    {
      //geodash.navigate.layer(data)
      var layerId = data["layer"];
      if(geodash.util.isString(layerId) && layerId.length > 0)
      {
        var fl = geodash.api.getFeatureLayer(layerId);
        if(geodash.util.isDefined(fl))
        {
          if(fl.type == "wms" || fl.type == "wfs")
          {
            var maxExtent = extract("view.maxExtent", fl);
            if(geodash.util.isDefined(maxExtent))
            {
              var m = geodash.var.map;
              var v = geodash.var.map.getView();
              var args = geodash.animations.chain(m, v, {"extent": maxExtent});
              if(args.length > 0)
              {
                v.animate.apply(v, args);
              }
              //geodash.var.map.beforeRender(ol.animation.pan({ duration: 1000, source: v.getCenter() }));
              //v.fit(geodash.normalize.extent(maxExtent, {sourceProjection: "EPSG:4326", targetProjection: "EPSG:3857"}));
            }
          }
          else
          {
            var m = geodash.var.map;
            var v = geodash.var.map.getView();
            var layer = geodash.var.featurelayers[data["layer"]];
            //geodash.var.map.beforeRender(ol.animation.pan({ duration: 1000, source: v.getCenter() }));
            //v.fit(layer.getSource().getExtent());
            var layerExtent: any = undefined;
            var features = layer.getSource().getFeatures().forEach((feature: any ) => {
              extract(["carto", "styles", 0, "symbolizers"], fl, []).forEach((sym: any ) => {
                var geom = feature.getGeometry().clone();
                extract(["transform", "operations"], sym, []).forEach((op: any) => {
                  if(op.name == "buffer")
                  {
                    var fn = extract("buffer", geodash.transform);
                    if(geodash.util.isDefined(fn))
                    {
                      var properties = geodash.util.arrayToObject(op.properties);
                      properties["feature"] = feature;
                      geom = fn(geom, properties)
                    }
                  }
                });
                layerExtent = geodash.util.isDefined(layerExtent) ? ol.extent.extend(layerExtent, geom.getExtent()) : geom.getExtent();
              });
            });
            if(geodash.util.isDefined(layerExtent))
            {
              //layerExtent = geodash.transform.buffer(layerExtent, 100);
              var buffer_distance = extract("config.buffer_distance", geodash, 100.0);
              layerExtent = ol.extent.buffer(layerExtent, buffer_distance);
              var args = geodash.animations.chain(m, v, {"extent": layerExtent});
              if(args.length > 0)
              {
                v.animate.apply(v, args);
              }
            }
          }
        }
      }
    }
    else if(geodash.util.isDefined(extract("extent", data)))
    {
      var newExtent = undefined;
      var extent = extract("extent", data);
      if(geodash.util.isString(extent))
      {
        if(extent == "initial")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.start($scope);
          }
        }
        else if(extent == "previous" || extent == "prev")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.back($scope);
          }
        }
        else if(extent == "next" || extent == "forward")
        {
          if(! geodash.var.map.getView().getAnimating())
          {
            //geodash.navigate.forward($scope);
          }
        }
      }
      else
      {
        geodash.navigate.location({
          "animate": extract("animate", data),
          "duration": extract("duration", data),
          "extent": geodash.normalize.extent(extent, {
            "sourceProjection": "EPSG:4326",
            "targetProjection": geodash.var.map.getView().getProjection().getCode()
          })
        });
      }
    }
    else
    {
      geodash.navigate.location({
        "animate": extract("animate", data),
        "duration": extract("duration", data),
        "lat": extract("lat", data),
        "lon": extract("lon", data),
        "zoom": extract("zoom", data),
        "minZoom": extract("minZoom", data)
      });
    }
  }

  onOpenPopup = (name: any, data: any, source: any): void => {
    console.log("Opening popup...", data);
    if(
      geodash.util.isDefined(data["featureLayer"]) &&
      geodash.util.isDefined(data["feature"]) &&
      geodash.util.isDefined(data["location"])
    )
    {
      geodash.popup.openPopup(
        this.interpolate,
        data["featureLayer"],
        data["feature"],
        data["location"],
        geodash.var.map,
        this.state
      );
    }
  }

  onAddFeatureLayers = (name: any, data: any, source: any): void => {
    var featurelayers = extract("featurelayers", data, []);
    if(featurelayers.length > 0)
    {
      for(var i = 0; i < featurelayers.length; i++)
      {
        var fl = featurelayers[i];
        geodash.layers.init_featurelayer({
          "id": fl.id,
          "fl": fl,
          "dashboard": this.dashboard,
          "state": this.state
        });
      }
    }

  }

  onUpsertFeatureLayers = (name: any, data: any, source: any): void => {
    var featurelayers = extract("featurelayers", data, []);
    if(featurelayers.length > 0)
    {
      for(var i = 0; i < featurelayers.length; i++)
      {
        var fl = featurelayers[i];

        var existingLayer = extract(["var", "featurelayers", fl["id"]], geodash);
        if(geodash.util.isDefined(existingLayer))
        {
          geodash.var.map.removeLayer(existingLayer);
        }

        if(extract("enabled", fl, true))
        {
          var t = extract("type", fl, "").toLowerCase();
          var initFn = undefined;
          if((t == "geojson" || t == "wms") && geodash.util.isDefined(extract("heatmap", fl, undefined)))
          {
            initFn = extract("heatmap", geodash.layers.featurelayer)
          }
          else
          {
            initFn = extract(t, geodash.layers.featurelayer);
          }
          initFn({
            "dashboard": this.dashboard,
            "id": fl["id"],
            "layerConfig": fl,
            "state": this.state,
            "cb": {
              "success": (function(){
                return function(options: any) {
                  //geodash.var.map.addLayer(extract("fl", options));
                  if(geodash.api.isVisible(options))
                  {
                    var layer_id = extract("id", options) || extract("layerID", options);
                    geodash.var.map.addLayer(extract("fl", options));
                    geodash.var.bus().emit("primary", "layerloaded", {
                      'type':'featurelayer',
                      'layer': layer_id,
                      'visible': true
                    }, undefined);
                  }
                }
              })(),
              "failed": function(x: any){
                geodash.log.error("layers", ["Could not initialize feature layer" + extract("id", x) +".", extract("fl", x)]);
              }
            }
          });
        }
      }
    }
  }

  onRemoveBaseLayers = (name: any, data: any, source: any): void => {
    var baselayers = extract("baselayers", data) || extract("layers", data, []);
    if(baselayers.length > 0)
    {
      for(var i = 0; i < baselayers.length; i++)
      {
        var existingLayer = extract(["var", "baselayers", baselayers[i]], geodash);
        if(geodash.util.isDefined(existingLayer))
        {
          geodash.var.map.removeLayer(existingLayer);
        }
        delete geodash.var.baselayers[baselayers[i]];
      }
    }
  }

  onRemoveFeatureLayers = (name: any, data: any, source: any): void => {
    var featurelayers = extract("featurelayers", data) || extract("layers", data, []);
    if(featurelayers.length > 0)
    {
      for(var i = 0; i < featurelayers.length; i++)
      {
        var existingLayer = extract(["var", "featurelayers", featurelayers[i]], geodash);
        if(geodash.util.isDefined(existingLayer))
        {
          geodash.var.map.removeLayer(existingLayer);
        }

        delete geodash.var.featurelayers[featurelayers[i]];
      }
    }
  }

  onReplaceFeatures = (name: any, data: any, source: any): void => {
    console.log("Opening popup...", data);
    if(
      geodash.util.isDefined(data["featurelayer"]) &&
      geodash.util.isDefined(data["features"])
    )
    {
      var layer = extract(data["featurelayer"], geodash.var.featurelayers);
      if(geodash.util.isDefined(layer))
      {
        var dataProjection = extract("projection", data, "EPSG:4326");
        var geojsondata = {
          'type': 'FeatureCollection',
          'crs': {
            'type': 'name',
            'properties': { 'name': dataProjection }
          },
          'features': data["features"]
        };
        var features = (new ol.format.GeoJSON()).readFeatures(geojsondata, {
          dataProjection: dataProjection,
          featureProjection: "EPSG:3857"
        });
        layer.getSource().clear();
        layer.getSource().addFeatures(features);
      }
    }
  }
}
