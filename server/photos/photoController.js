var imgur = require('imgur');
var Photo = require('./photoModel');
var mongoose = require('mongoose');

module.exports = {
  // recieve base64 bit image in two POST request packets
  // send that file to imgur
  uploadPhoto: (function() {
      var currentPipes= {
        // key pairs are the userId and the data.
        userId: 'data'
      }

      return function (req, res, next) {
      // check if it is first or second packet
      var userId = req.body.userId;
      if (currentPipes[userId] === undefined) {
        currentPipes[userId] = req.body.data;
        console.log(1)
        // if the userId is there, we know that the photo is halfway upladed
      } else if (currentPipes[userId]) {
        console.log(2)
        var fullImgData = currentPipes[userId] + req.body.data;
        // clear out userId data space for future images
        currentPipes[userId] = undefined;
        console.log(fullImgData)
        imgur.uploadBase64(fullImgData)
        .then(function (json) {
          console.log(json.data.link);
          req.imgurLink = json.data.link;
          next();
        })
        .catch(function (err) {
          console.error(err.message);
        });
      }

      }
    })(),

  // save that photo as  a model in db
  savePhotoModelToDB: function (req, res, next) {
    console.log(req.body.userId);
    new Photo({
      url: req.imgurLink,
      loc: {
        type: 'Point',
        coordinates: [req.body.longitude, req.body.latitude]
      },
      userId: req.body.userId
    }).save().then(function(data) {
      Photo.ensureIndexes({loc:"2dsphere"});
      console.log('saved new photo model to db ', data)
      next();
    }).catch(function(err) {
      console.log('could not save to db', err)
    })
  },

  // fetch all photos from DB
  fetchPhotos: function (req, res, next) {
    var maxDistance = Number(req.query.radius);
    var coords = [req.query.lon, req.query.lat];

    Photo.find({
      loc: {
        $near: {
          $geometry: {
             type: "Point" ,
             coordinates: coords
          },
          $maxDistance: maxDistance
        }
      }
    })
      .then(function(photos) {
        res.json(photos);
      })
      .fail(function(error) {
        // console.log('error: ',error);
        next(error);
      });
  },

  fetchLocations: function (req, res, next) {
    var lat = Number(req.query.lat);
    var lon = Number(req.query.lon);
    var latdelta = Number(req.query.latdelta);
    var londelta = Number(req.query.londelta);
    var coords = [[
      [lon-londelta, lat+latdelta],
      [lon+londelta, lat+latdelta],
      [lon+londelta, lat-latdelta],
      [lon-londelta, lat-latdelta],
      [lon-londelta, lat+latdelta]
    ]];

    var revealedPhotos = undefined;

    Photo.find({
      loc: {
        $near: {
          $geometry: {
             type: "Point" ,
             coordinates: [req.query.lon, req.query.lat]
          },
          $maxDistance: 50
        }
      }
    }).select('_id')
      .then(function(photos) {
        revealedPhotos = photos;
        Photo.find({
          loc: {
            $geoWithin: {
              $geometry: {
                 type: "Polygon" ,
                 coordinates: coords
              }
            }
          }
        }).nin('_id', revealedPhotos)
          .then(function(photos) {
            res.json(photos);
          })
          .fail(function(error) {
            console.log('error: ',error);
            next(error);
          });
      })
      .fail(function(error) {
        next(error);
      })
  }
};
