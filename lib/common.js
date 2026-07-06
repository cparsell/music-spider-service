/**
 * ----------------------------------------------------------------------------------------------------------------
 * Remove duplicates from an array
 * @param {array} array
 * @param {bool} removeBlanks if true, will remove empty array elements
 * @returns {array} array
 */
export function arrayRemoveDupes(array, removeBlanks = false) {
  try {
    if (array.length < 1) {
      throw new Error("Array length 0");
    }
    array.sort();
    let unique = [...new Set(array)];
    let filtered = unique.filter((n) => n);
    return filtered;
  } catch (err) {
    console.error(`Common.arrayRemoveDupes() - ${err}`);
    return [];
  }
}

/**
 * Returns an array in rows of X
 * @param {array} array
 * @param {*} chunkSize
 * @returns
 */
export function chunkArray(array, chunkSize) {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Collate objects at given path, from array of JSON strings
 * @param {array} path
 * @param {object} objects
 * @returns {array}
 */
export function collateArrays(path, objects) {
  const chunks = path.split(".");
  return objects.flatMap((obj) => {
    return chunks.reduce((acc, chunk) => acc[chunk], obj);
  });
}

/**
 * ----------------------------------------------------------------------------------------------------------------
 * Return TRUE if number is even, FALSE if it is odd
 * @param {number} n
 * @returns {bool}
 */
export function isEven(n) {
  return n % 2 == 0;
}

export const formatDateDashes = (date) => {
  let formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date).replace(/\//g, "-");
};
/**
 * Format a date in the format mm/dd/yyyy
 * @param {Date} date
 * @returns
 */
export const formatDateSlashes = (date) => {
  let formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};

/**
 * Format a date in the format Sun Mar 24, 2024
 * @param {Date} date
 * @returns
 */
export function formatDateString(date) {
  if (isNaN(date)) date = new Date(date);
  const options = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Format a date in the format MM/DD/YYYY HH:mm
 * @param {Date} date
 * @returns
 */
export const formateDateTime = (dateTime) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", // Handle PST/PDT automatically
    year: "numeric",
    month: "2-digit", // "MM" format
    day: "2-digit", // "dd" format
    hour: "2-digit", // "HH" format, 24-hour clock
    minute: "2-digit", // "mm" format
    hour12: false, // Ensure 24-hour time format is used
  });

  // Format the date and time
  return formatter.format(startTime);

  // The output format might slightly differ based on t
};

/**
 * Format a date in the format YYYY/MM/DD HH:mm
 * @param {Date} date
 * @returns
 */
export function formatDateTimeB(date) {
  // Pad the month, day, hour, and minute with leading zeros if necessary
  const pad = (num) => num.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // getMonth() returns 0-11
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  // Construct the formatted date string
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

export function formatTimeAs12HourWithoutMinutes(
  date,
  showMinutesIfNonZero = false,
) {
  // Ensure the input is a Date object
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  let hours = date.getHours();
  let min = date.getMinutes();
  min !== 0 && showMinutesIfNonZero ? (min = `:${min}`) : (min = "");
  const ampm = hours >= 12 ? "pm" : "am";
  // Convert 24h time to 12h time
  hours %= 12;
  // 0 should be shown as 12
  hours = hours || 12;

  return `${hours}${min}${ampm}`;
}

/**
 * Companion function for stringSimilarity()
 *
 * @param s1
 * @param s2
 * @returns
 */
function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Sleep for X ms
 * @param {*} ms
 * @returns
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ------------------------------------------------------------------------------------------------------
 * Compares two strings and returns a percentage of how similar the two are
 * source: https://stackoverflow.com/questions/10473745/compare-strings-javascript-return-of-likely
 * @param {string} s1
 * @param {string} s2
 * @returns {float} score
 */
export function stringSimilarity(s1, s2) {
  if (s1 == undefined || s2 == undefined) return 0;
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (
    (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
  );
}

/**
 * Sort array alphabetically
 *
 * @param {arr} array
 * @returns {array}
 */
export function arrayFunc(arr) {
  return arr.sort();
}
