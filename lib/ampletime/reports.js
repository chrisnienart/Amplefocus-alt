import {_dataURLFromBlob, _insertColumnInMemory} from "../data-structures.js";
import {_durationToSeconds} from "./date-time.js";
import {_dictToMarkdownTable} from "../markdown.js";

export async function _createLegendSquare(color, options) {
  console.log(`_createLegendSquare(${color})`);
  let canvas;
  try {
    canvas = document.createElement("canvas");
  } catch (err) {
    console.error("document object not found");
    return;
  }
  const ctx = canvas.getContext("2d");
  const size = options.legendSquareSize;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  console.log(canvas);
  function canvasToBlob(canvas2) {
    return new Promise((resolve) => {
      canvas2.toBlob((blob2) => {
        resolve(blob2);
      }, "image/png");
    });
  }
  console.log(canvasToBlob);
  let blob = await canvasToBlob(canvas);
  console.log(blob);
  return await _dataURLFromBlob(blob);
}

export async function _generateRadar(taskDistribution) {
  console.log(`_generateRadar(${taskDistribution})`);
  let radarLabels = {
    q1: "Q1: Important & Urgent",
    q2: "Q2: Important",
    q3: "Q3: Urgent",
    q4: "Q4: Neither"
  };
  let data = {
    labels: Object.keys(taskDistribution),
    datasets: [
      {
        label: "Number of tasks",
        // Convert from number of tasks to percentage of total number of tasks
        data: Object.values(taskDistribution).map(
          (e) => e.count / Object.values(taskDistribution).reduce((pv, cv) => pv + cv.count, 0) * 100
        ),
        fill: true,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgb(255, 99, 132)",
        pointBackgroundColor: "rgb(255, 99, 132)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgb(255, 99, 132)"
      },
      {
        label: "Time spent",
        // Convert from duration to percentage of total duration
        data: Object.values(taskDistribution).map(
          (e) => e.duration / Object.values(taskDistribution).reduce((pv, cv) => pv + cv.duration, 0) * 100
        ),
        fill: true,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgb(54, 162, 235)",
        pointBackgroundColor: "rgb(54, 162, 235)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgb(54, 162, 235)"
      }
    ]
  };
  const chart = new QuickChart();
  chart.setVersion("4");
  chart.setWidth(500);
  chart.setWidth(500);
  chart.setConfig({
    type: "radar",
    data
  });
  console.log(chart.getUrl());
  let response = await fetch(chart.getUrl());
  let blob = await response.blob();
  return await _dataURLFromBlob(blob);
}

export async function _generatePie(taskDurations, options) {
  console.log(`generatePie(${taskDurations})`);
  const labels = taskDurations.map((task) => task["Entry Name"]);
  console.log(labels);
  const data = taskDurations.map((task) => _durationToSeconds(task["Duration"]));
  console.log(data);
  const chart = new QuickChart();
  chart.setVersion("4");
  chart.setWidth(500);
  chart.setHeight(500);
  chart.setConfig({
    type: "pie",
    data: {
      labels,
      datasets: [{ data, backgroundColor: options.colors }]
    },
    options: {
      plugins: {
        legend: {
          // Hide the legend because it's too large & ugly
          display: false
        },
        // On the chart itself, show percentages instead of durations
        // Only show percentages if larger than a certain value, to avoid jankiness
        datalabels: {
          display: true,
          formatter: (value, ctx) => {
            let sum = 0;
            let dataArr = ctx.chart.data.datasets[0].data;
            dataArr.map((data2) => {
              sum += data2;
            });
            let percentage = (value * 100 / sum).toFixed(0);
            if (percentage < 7)
              return "";
            return percentage + "%";
          },
          color: "#fff"
        }
      }
    }
  });
  console.log(chart.getUrl());
  let response = await fetch(chart.getUrl());
  let blob = await response.blob();
  return await _dataURLFromBlob(blob);
}

export async function _generateDurationsReport(app, options, resultsHandle, taskDurations) {
  console.log(`Creating legend squares...`);
  let legendSquares = [];
  for (let i = 0; i < taskDurations.length; i++) {
    let fileURL2 = await app.attachNoteMedia(
      resultsHandle,
      await _createLegendSquare(options.colors[i], options)
    );
    legendSquares.push(`![](${fileURL2})`);
  }
  taskDurations = _insertColumnInMemory(
    taskDurations,
    "Color",
    legendSquares
  );
  console.log(taskDurations);
  let resultsTable = _dictToMarkdownTable(taskDurations);
  console.log(resultsTable);
  console.log(`Inserting results in report note...`);
  await app.insertNoteContent(resultsHandle, resultsTable);
  console.log(`Generating QuickChart...`);
  let pieDataURL;
  try {
    pieDataURL = await _generatePie(taskDurations, options);
  } catch (err) {
    pieDataURL = "";
  }
  const fileURL = await app.attachNoteMedia(resultsHandle, pieDataURL);
  await app.insertNoteContent(resultsHandle, `![](${fileURL})`);
}

export async function _generateQuadrantReport(app, resultsHandle, taskDistribution, options) {
  let totalLength = Object.values(taskDistribution).reduce((pv, cv) => pv + cv.count, 0);
  let percentages = {
    q1: taskDistribution.q1.count / totalLength,
    q2: taskDistribution.q2.count / totalLength,
    q3: taskDistribution.q3.count / totalLength,
    q4: taskDistribution.q4.count / totalLength
  };
  let percentagesDict = Object.keys(percentages).map((key) => {
    return { "Quadrant": key, "Percentage": `${percentages[key] * 100}%` };
  });
  let resultsTable = _dictToMarkdownTable(percentagesDict);
  console.log(resultsTable);
  console.log(`Inserting results in report note...`);
  await app.insertNoteContent(resultsHandle, resultsTable);
  console.log(`Generating QuickChart (radar)...`);
  let pieDataURL;
  try {
    pieDataURL = await _generateRadar(taskDistribution, options);
  } catch (err) {
    console.log(err);
    pieDataURL = "";
  }
  const fileURL = await app.attachNoteMedia(resultsHandle, pieDataURL);
  await app.insertNoteContent(resultsHandle, `![](${fileURL})`);
}