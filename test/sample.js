/**
 *  Orbita, Inc. (TM)
 *  Copyright (c) 2016
 */
module.exports = function (RED) {
  "use strict";

  var path = require('path');
  var moment = require('moment-timezone');
  var commonUtil = require(path.join(process.cwd(), 'server/utilities/common-utils'));
  var eventService = require(path.join(process.cwd(), 'server/services/events'));
  var async = require('async');

  var convertDateWithTimeZone = function (date, time, timezone) {
    // console.log(date, time);
    var startDate = date && date !== '' ? date : moment.tz(timezone).format('YYYY-MM-DD');
    var startTime = (time && time !== '' && time !== undefined) ? time : moment.tz(timezone).format('hh:mm');
    var utcDate = moment.tz((startDate + ' ' + startTime), 'YYYY-MM-DD HH:mm', timezone).utc();
    console.log('date recived : =====', startDate, startTime, timezone, utcDate.isValid(), utcDate.format());
    // console.log("date comparistion", moment.tz('23:59', 'HH:mm', timezone).utc() > utcDate);
    return utcDate.isValid() ? utcDate.format() : moment.tz(timezone).utc().format();
  };

  var setEndDate = function (timezone) {
    return moment.tz('23:59', 'HH:mm', timezone).utc().format();
  };

  var serviceCall = function (node, msg) {
    return new Promise(function (resolve, reject) {
      try {
        var payload = commonUtil.mustacheString(node.payload, msg);
        // payload = payload.replace(/&quot;/g, '"');
        var currentAction = node.action;
        var userObj = msg.alexaRequest && msg.alexaRequest.data ? msg.alexaRequest.data.session.user : null;
        var user = userObj ? userObj.currentUserId : null;
        var body = JSON.parse(payload);
        // If there is no timeZone then we choose EST
        var timeZone = userObj && userObj.personaProfile ? userObj.personaProfile.timezone : 'EST';
        var options = {
          user: user,
          body: body,
          methodName: '',
          params: {
            id: body.id,
            calendarid: node.calendar
          }
        };
        //TODO:- Need to change this into generic one
        if (body && body.participants) {
          body.participants = (msg.payload && msg.payload.participants) ? JSON.parse(msg.payload.participants) : commonUtil.mustacheObject(body.participants, msg);
        }
        var daysInWeek = [];
        var isPatteren = (body.frequency !== undefined && body.frequency.patterns !== undefined && body.frequency.patterns.daysInWeek !== undefined);
        if (isPatteren) {
          daysInWeek = body.frequency.patterns.daysInWeek || [];
        }
        if (body.isParent !== '' && body.isParent !== undefined) {
          body.isParent = (body.isParent === 'true');
        }
        if (daysInWeek !== '' && daysInWeek !== null && daysInWeek !== undefined && isPatteren) {
          body.frequency.patterns.daysInWeek = (typeof daysInWeek === 'string') ? daysInWeek.match(/[0-9]/ig) : daysInWeek;
        }
        switch (currentAction) {
          case 'Create':
            options.methodName = 'createEvent';
            break;
          case 'Get':
            options.methodName = 'getEvent';
            break;
          case 'Update':
            options.methodName = 'updateEvent';
            // options.body.endDate = body.toDate ? convertDateWithTimeZone(body.toDate, body.toTime, timeZone) : setEndDate(timeZone);
            options.body.startDate = convertDateWithTimeZone(body.fromDate, body.fromTime, timeZone);
            options.user = { _id: user };
            console.log('start Date =====', options.body.startDate);
            // console.log(options.body);
            break;
          case 'Remove':
            options.methodName = 'deleteEvent';
            break;
          case 'listEvents':
            options.methodName = 'getEvents';
            options.body.fromDate = convertDateWithTimeZone(body.fromDate, body.fromTime, timeZone);
            var toTime = body.toTime ? body.toTime : '23:59';
            options.body.toDate = body.toDate ? convertDateWithTimeZone(body.toDate, toTime, timeZone) : setEndDate(timeZone);
            options.body.user = body.user ? body.user : user;
            if (options.body.participants) {
              var participants = options.body.participants.replace(/&quot;/g, '"');
              participants = (typeof participants === 'string') ? [participants] : participants;
              options.body.participants = participants;
            }
            if (options.body.attributes) {
              var keys = Object.keys(options.body.attributes);
              for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                options.body.attributes[key] = options.body.attributes[key].split(',');
              }
            }
            // options.body.participants = body.participants ? body.participants : [user];
            if (options.body.fromDate > options.body.toDate) {
              options.body.toDate = moment.tz(options.body.fromDate, timeZone).add(((60 * 60 * 24) - 1), 'seconds').utc().format();
            }
            console.log(JSON.stringify(options, null, 2));
            break;
        }
        eventService[options.methodName](options, function (err, data) {
          var result;
          try {
            result = JSON.parse(JSON.stringify(data));
          } catch (err) {
            result = {};
          }
          if (err) {
            reject(err);
          } else if (result && result.reason) {
            reject(result.reason);
          } else {
            resolve(result);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };


  var resultHandler = function (node, msg) {
    var user = msg.alexaRequest && msg.alexaRequest.data ? msg.alexaRequest.data.session.user : null;
    var timeZone = user && user.personaProfile ? user.personaProfile.timezone : 'EST';
    console.log("timeZone is ====", timeZone);
    return function (resultdata) {
      function getDateAndTime(callback) {
        if (typeof resultdata === 'object' && resultdata.length > 0) {
          for (var i = 0; i < resultdata.length; i++) {
            if (resultdata[i].startDate) {
              resultdata[i].localDate = moment.tz(resultdata[i].startDate, timeZone).format('YYYY-MM-DD h:mm A');
            }
          }
        }
        callback(null, resultdata);
      }
      async.waterfall([
        getDateAndTime,
      ], function (err, events) {
        if (typeof msg.data === 'object') {
          msg.data.calenderData = events;
        } else if (msg.data && typeof msg.data !== 'object') {
          msg.data = { calenderData: events, nodeData: msg.data };
        } else {
          var key = 'data';
          msg[key] = events;
        }
        return node.send(msg);
      });
      // if (typeof msg.data === 'object') {
      //   msg.data.calenderData = resultdata;
      // } else if (msg.data && typeof msg.data !== 'object') {
      //   msg.data = { calenderData: resultdata, nodeData: msg.data };
      // } else {
      //   var key = 'data';
      //   msg[key] = resultdata;
      // }
      // return node.send(msg);
    };
  };

  var errorHandler = function (node, msg) {
    return function (err) {
      return node.error(err, msg);
    };
  };

  function DynamicCalendarManager(n) {
    RED.nodes.createNode(this, n);

    this.action = n.action;
    this.calendar = n.calendar;
    this.payload = n.payload;

    var node = this;

    this.on("input", function (msg) {
      serviceCall(node, msg)
        .then(resultHandler(node, msg))
        .catch(errorHandler(node, msg));
    });

  }

  RED.nodes.registerType("orbita-calendar-manager", DynamicCalendarManager);

};
