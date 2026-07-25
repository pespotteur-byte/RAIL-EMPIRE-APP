import { wrapTime } from './service-utils.js?v=1785016545';

export class ServiceStop {
  constructor(stationId, type, depTime, arrTime, voiePointId, platform, stopCode = '') {
    this.stationId = stationId;
    this.type = type;
    this.stopCode = stopCode || '';
    this.departureTime = wrapTime(depTime);
    this.arrivalTime = wrapTime(arrTime) || this.departureTime;
    this.voiePointId = voiePointId || null;
    this.platform = platform || '';
  }
}
