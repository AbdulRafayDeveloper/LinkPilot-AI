import test from "node:test"
import assert from "node:assert/strict"
import load from "./load.mjs"

const { toTwelveHour, fromTwelveHour, formatTime } = load("lib/meetingDates.ts")
const { TIME_PATTERN } = load("constants/meetingPlanner.ts")

// Every minute of the hour, which is what the picker offers with no gaps
const EVERY_MINUTE = Array.from({ length: 60 }, (_, index) => `${index}`.padStart(2, "0"))

test("a meeting can be put on any minute of the hour, not just a five-minute mark", () => {
  for (const minute of EVERY_MINUTE) {
    const time = `09:${minute}`
    assert.ok(TIME_PATTERN.test(time), `${time} is a time the app accepts`)
  }
  // The ones a five-minute picker could never reach
  for (const minute of ["01", "07", "23", "38", "59"]) {
    assert.ok(TIME_PATTERN.test(`14:${minute}`), `14:${minute} is a time the app accepts`)
  }
})

test("there are sixty minutes offered and no gaps between them", () => {
  assert.equal(EVERY_MINUTE.length, 60)
  assert.equal(EVERY_MINUTE[0], "00")
  assert.equal(EVERY_MINUTE.at(-1), "59")
  const missing = EVERY_MINUTE.filter((minute, index) => Number(minute) !== index)
  assert.deepEqual(missing, [], "each minute is one more than the one before it")
})

test("every minute of every hour survives the trip to the 12-hour clock and back", () => {
  for (let hour24 = 0; hour24 < 24; hour24++) {
    for (const minute of EVERY_MINUTE) {
      const saved = `${`${hour24}`.padStart(2, "0")}:${minute}`
      const { hour, minute: shown, period } = toTwelveHour(saved)
      assert.equal(fromTwelveHour(hour, shown, period), saved, `${saved} came back as something else`)
      assert.equal(shown, minute, `${saved} lost its minute`)
    }
  }
})

test("the time reads the way it is said, on an odd minute as much as a round one", () => {
  assert.equal(formatTime("09:07"), "9:07 AM")
  assert.equal(formatTime("14:38"), "2:38 PM")
  assert.equal(formatTime("00:01"), "12:01 AM")
  assert.equal(formatTime("12:59"), "12:59 PM")
})

test("a time that is not a real one is still refused", () => {
  for (const bad of ["24:00", "09:60", "9:07", "0907", "", "09:7"]) {
    assert.equal(TIME_PATTERN.test(bad), false, `${bad} is not a time`)
  }
})
