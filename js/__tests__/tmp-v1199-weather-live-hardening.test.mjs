import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather } from '../weather.js';

test('live Open-Meteo payload cannot inject NaN/Infinity into weather state', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok:true, json:async()=>({current:{
    temperature_2m:'Infinity', relative_humidity_2m:'-50', precipitation:'NaN', weather_code:'95',
    wind_speed_10m:'9999', wind_direction_10m:'Infinity', cloud_cover:'200', cloud_cover_low:'-1',
    cloud_cover_mid:'50', cloud_cover_high:'Infinity', pressure_msl:'99999', apparent_temperature:'bad',
    visibility:'Infinity', uv_index:'Infinity', dew_point_2m:'NaN'
  }}) });
  try {
    const w = new Weather();
    await w._fetchLiveWeather(48.8, 2.3);
    for (const key of ['temperature','humidity','precipitation','windSpeed','cloudCover','cloudLow','cloudMid','cloudHigh','pressure','apparentTemp','windDirection','visibility','uvIndex','dewpoint']) {
      assert.ok(Number.isFinite(w[key]), `${key} must be finite`);
    }
    assert.equal(w.current, 'storm');
    assert.equal(w.humidity, 0);
    assert.equal(w.windSpeed, 500);
    assert.equal(w.cloudCover, 100);
  } finally { global.fetch = oldFetch; }
});

test('point weather payload is finite-sanitized', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => ({ok:true,json:async()=>({current:{temperature_2m:'Infinity',wind_speed_10m:'NaN',precipitation:'Infinity',weather_code:61}})});
  try {
    const w = new Weather();
    const state = await w._fetchLiveWeatherFor(48,2);
    assert.ok(Number.isFinite(state.temperature));
    assert.ok(Number.isFinite(state.windSpeed));
    assert.ok(Number.isFinite(state.precipitation));
    assert.equal(state.type,'rain');
  } finally { global.fetch = oldFetch; }
});

test('malformed realism setting cannot poison braking physics', () => {
  const oldWindow = global.window;
  try {
    global.window = {game:{realismSettings:{weather:'Infinity'}}};
    const w = new Weather();
    w.current='snow';
    const a=w.getSpeedEffectsAt(999,999,160);
    assert.ok(Number.isFinite(a.brakeFactor));
    assert.ok(Number.isFinite(a.speedCap));
    assert.equal(a.brakeFactor,0.55);
    assert.equal(a.speedCap,140);

    global.window = {game:{realismSettings:{weather:99}}};
    const b=w.getSpeedEffectsAt(999,999,160);
    assert.ok(Math.abs(b.brakeFactor-0.1)<1e-9); // clamped realism=2 => max degradation, clamped at 0.1
    assert.equal(b.speedCap,120);
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
  }
});

test('wind direction label survives invalid/negative direction', () => {
  const w=new Weather();
  assert.equal(w._windDirLabel(NaN),'N');
  assert.equal(w._windDirLabel(-90),'O');
});
