var Q = require('q');
var User = require('./userModel');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var Photo = require('./../photos/photoModel');

var findUser = Q.nbind(User.findOne, User);
var findUsers = Q.nbind(User.find, User);
var createUser = Q.nbind(User.create, User);

module.exports = {
  login: function(req, res, next) {
    var user = JSON.parse(Object.keys(req.body)[0]);
    var username = user.username;
    var password = user.password;

    findUser({ username: username })
      .then(function(user) {
        if (!user) {
          next(new Error('User does not exist'));
        } else {
          return user.comparePasswords(password)
            .then(function(foundUser) {
              if (foundUser) {
                var token = jwt.sign({ username: username, userId: user._id }, 'FRANKJOEVANMAX');
                res.json({ userId: user._id, token: token });
              } else {
                return next(new Error('Incorrect password'));
              }
            });
        }
      })
      .fail(function(error) {
        next(error);
      });
  },

  signup: function(req, res, next) {
    var user = JSON.parse(Object.keys(req.body)[0]);
    var username = user.username;
    var password = user.password;

    findUser({ username: username })
      .then(function(user) {
        if (user) {
          next(new Error('User already exist!'));
        } else {
          return createUser({
            username: username,
            password: password
          }).then(function(user) {
            console.log('Created user', user)
              // Generate JWT for user here
              // params: payload, secret key, encryption, callback
            var token = jwt.sign({ username: user.username, userId: user._id }, 'FRANKJOEVANMAX');
            console.log('token created', token)
            res.json({ token: token, userId: user._id, username: user.username })
            next()
          }).catch(function(err) {
            console.error('problem creating user', err);
          });
        }
      })
      .fail(function(error) {
        next(error);
      });
  },

  checkJWT: function(req, res, next) {
    console.log('imcomming GET for JWT', req.params.JWT)
    var decoded = jwt.verify(req.params.JWT, 'FRANKJOEVANMAX', function(err, decoded) {
      if (err) console.log('problem decoding', err);
      else {
        // send back decoded.userId and decoded.username
        res.json({ username: decoded.username, userId: decoded.userId });
        next();
      }
    });
    // send back user id
  },

  changePassword: function(req, res, next) {
    var user = JSON.parse(Object.keys(req.body)[0]);
    var username = user.username;
    var password = user.password;
    var newPassword = user.newPassword;

    findUser({ username: username })
      .then(function(user) {
        if (!user) {
          next(new Error('User does not exist!'));
        } else {
          return user.comparePasswords(password)
            .then(function(foundUser) {
              user.password = newPassword;
              user.save(function(err, savedUser) {
                if (err) next(err);
                res.json();
              })
            }).catch(function(err) {
              console.error('problem changing user info', err);
            });
        }
      })
      .fail(function(error) {
        next(error);
      });
  },

  changeUsername: function(req, res, next) {
    var user = JSON.parse(Object.keys(req.body)[0]);
    var username = user.username;
    var newUsername = user.newUsername;

    findUser({ username: username })
      .then(function(user) {
        if (!user) {
          next(new Error('User does not exist!'));
        } else {
          user.username = newUsername;
          user.save(function(err, savedUser) {
            if (err) next(err);
            res.json({ username: savedUser.username });
          })
        }
      })
      .fail(function(error) {
        next(error);
      });
  },

  toggleFavorite: function(req, res, next) {
    var url = req.query.url;
    User.findOne({ _id: mongoose.mongo.ObjectID(req.query.userId) }, function(err, user) {
      if (err) next(err);
      if (!user) {
        console.error('User was not found');
      } else {
        if (user.favorites.indexOf(url) === -1) {
          user.favorites.push(url);
        } else {
          user.favorites.splice(user.favorites.indexOf(url), 1);
        }
        user.save(function(err, savedUser) {
          res.json();
        });
      }
    });
  },

  toggleStream: function(req, res, next) {
    var url = req.query.url;
    Photo.findOne({url: url})
      .then((photo) => {
        User.findOne({ _id: photo.userId})
          .then((foundUser) => {
          // if adding to stream
            if(foundUser.streams.indexOf(url) === -1) {
              foundUser.streams.push(photo.url);
              foundUser.streamsObjects.push(photo._id);
              foundUser.save((err, savedUser) => {
                if (err) {
                  next(err);
                }
                res.send(savedUser);
              });
            } else {
              foundUser.streams.splice(foundUser.streams.indexOf(photo.url), 1);
              foundUser.streamsObjects.splice(foundUser.streamsObjects.indexOf(photo._id), 1);
              foundUser.save((err, savedUser) => {
                if (err) {
                  next(err);
                }
                res.send(savedUser);
              });
            }
          })
          .catch((err) => {
            console.log('error finding user', err);
          });
      })
      .catch( (err) => {
        console.log('error finding photo', err);
      }
    );
  },

  getPhotoData: function(req, res, next) {
    var currentUserId = req.query.userId;
    Photo.findOne({ url: req.query.url }, function(err, photo) {
      if (err) next(err);
      if (photo) {
        User.findOne({ _id: mongoose.mongo.ObjectID(photo.userId) }, function(err, user) {
          if (err) next(err);
          if (!user) {
            console.error('User was not found');
          } else {
            User.findOne({ _id: mongoose.mongo.ObjectID(currentUserId) }, function(err, user) {
              if (err) next(err);
              if (!user) {
                console.error('User was not found 2');
              } else {
                var favorited = (user.favorites.indexOf(req.query.url) === -1);
                var streamed = (user.streams.indexOf(req.query.url) === -1);
                res.json({ username: user.username, views: photo.views, favorited: !favorited, streamed: !streamed });
              }
            });
          }
        });
      }
    });
  },

  fetchFavorites: function(req, res, next) {
    User.findOne({ _id: mongoose.mongo.ObjectID(req.query.userId) }, function(err, user) {
      if (err) next(err);
      if (!user) {
        console.error('User was not found');
      } else {
        res.json(user.favorites);
      }
    });
  },

  fetchStreams: function(req, res, next) {
    User.findOne({ _id: mongoose.mongo.ObjectID(req.query.userId) }, function(err, user) {
      if (err) next(err);
      if (!user) {
        console.error('User was not found');
      } else {
        res.json(user.streams);
      }
    });
  },

  fetchStreamsObjects: function(req, res, next){
    //fetch streamsObject with photo_id and .populate method, see fetch friends below
    var streamsPhotosArr = [];
    
    User.findOne({ _id: mongoose.mongo.ObjectID(req.query.userId) })
      .populate('streamsObjects', 'url loc visibility')
      .exec(function (err, user) {
        if (err) {
          next(err);
        } else {
          for (var i = 0; i < user.streamsObjects.length; i++) {
            streamsPhotosArr.push({
              url: user.streamsObjects[i].url,
              latLng: {
                latitude: user.streamsObjects[i].loc.coordinates[0],
                longitude: user.streamsObjects[i].loc.coordinates[1]
              },
              visibility: user.streamsObjects[i].visibility
            });
          }
          res.json(streamsPhotosArr);
        }
      });
  },
  
  fetchUsersBySearchInput: function(req, res, next) {
    var username = req.query.search;

    findUsers({ username: username.toLowerCase() }, function (err, foundUsers) {
      if (err) {
        next(err);
      }
      if (!foundUsers) {
        res.statusCode(404).res('Couldn\'t find any matching users');
      } else {
        res.send(foundUsers);
      }
    });
  },

  addFriend: function(req, res, next) {
    var friendRequest = JSON.parse(Object.keys(req.body)[0]);

    findUser({ _id: friendRequest.userId })
      .then(function(user) {
        if (!user) {
          next(new Error('User does not exist'));
        } else {
          user.friends.push(mongoose.mongo.ObjectID(friendRequest.friendId));
          user.friendIdsString.push(friendRequest.friendId);
          user.save(function(err, savedUser) {
            if (err) { 
              next(new Error(err));
            } else {
              findUser({ _id: friendRequest.friendId })
                .then(function(user) {
                  if (!user) {
                    next(new Error('User does not exist'));
                  } else {
                    user.friends.push(mongoose.mongo.ObjectID(friendRequest.userId));
                    user.save(function(err, savedUser) {
                      if (err) { 
                        next(new Error(err));  
                      } else {
                        res.send('Friend added!');
                      }
                    });
                  }    
                });
            }
          });
        }
      })
      .fail(function(error) {
        next(error);
      });
  },

  fetchFriends: function(req, res, next) {
    var friendsArr = [];
    
    User.findOne({ _id: mongoose.mongo.ObjectID(req.query.userId) })
      .populate('friends', '_id username streamsObjects')
      .exec(function (err, user) {
        if (err) {
          next(err);
        } else {
          for (var i = 0; i < user.friends.length; i++) {
            friendsArr.push(user.friends[i]);
          }
          res.json(friendsArr);
        }
      });
  }
};
