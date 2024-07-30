const transformOrder = [
    'ALR', 'ILR', 'ExpandedSoftmax', 'NormalizedExponential',
    'StanStickbreaking', 'StickbreakingLogistic', 'StickbreakingNormal',
    'StickbreakingPowerLogistic', 'StickbreakingPowerNormal',
    'StickbreakingAngular'
];

// Define colors for transforms
const transformColors = d3.scaleOrdinal(d3.schemeCategory10).domain(transformOrder);

function plotSummary(data, selectedColumn, numCols) {
    // Remove rows where the selected column is empty
    const filteredData = data.filter(row => row[selectedColumn] !== '');

    // Get unique target_config and target values for subplots
    const uniqueConfigs = [...new Set(filteredData.map(row => `${row.target} ${row.target_config}`))];
    const numRows = Math.ceil(uniqueConfigs.length / numCols);

    const fig = {
        data: [],
        layout: {
            grid: { rows: numRows, columns: numCols, pattern: 'independent', roworder: 'top to bottom' },
            title: `${selectedColumn} vs transform`,
            showlegend: false, // Disable legend in the plot
            height: numRows * 300,  // Adjust height to make subplots taller
            margin: { l: 80, r: 20, b: 60, t: 50 },  // Adjust margins to ensure titles are visible
            shapes: []
        }
    };

    // Add traces and lines for each subplot
    const legendTraces = [];
    uniqueConfigs.forEach((config, index) => {
        const [target, targetConfig] = config.split(' ');
        const row = Math.floor(index / numCols) + 1;
        const col = (index % numCols) + 1;

        const configData = filteredData.filter(row => row.target === target && row.target_config === targetConfig);

        transformOrder.forEach(transform => {
            const transformData = configData.filter(row => row.transform === transform);

            const trace = {
                x: transformData.map(row => row.transform),
                y: transformData.map(row => Number(row[selectedColumn])),
                type: (selectedColumn === 'min_rel_ess_bulk' || selectedColumn === 'max_rhat') ? 'scatter' : 'box',
                mode: 'markers',  // For scatter plot
                name: transform,
                legendgroup: transform,
                marker: { color: transformColors(transform) },
                xaxis: `x${index + 1}`,
                yaxis: `y${index + 1}`
            };

            fig.data.push(trace);

            if (!legendTraces.some(t => t.name === transform)) {
                legendTraces.push({
                    name: transform,
                    marker: { color: transformColors(transform) },
                    type: 'scatter',
                    mode: 'markers',
                    x: [null],
                    y: [null]
                });
            }
        });

        fig.layout[`xaxis${index + 1}`] = { title: 'transform', showticklabels: row === numRows, visible: row === numRows, automargin: true, tickangle: 45 };
        fig.layout[`yaxis${index + 1}`] = { title: selectedColumn, type: selectedColumn !== 'n_divergent' && selectedColumn !== 'bfmi' ? 'log' : 'linear', automargin: true, tickpadding: 10 };
        fig.layout[`annotations`] = fig.layout[`annotations`] || [];
        fig.layout[`annotations`].push({
            text: `<b>${config}</b>`,
            x: 0.5,
            y: 1,
            xref: `x${index + 1} domain`,
            yref: `y${index + 1} domain`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'bottom'
        });

        // Add horizontal lines for specific columns
        if (selectedColumn === 'bfmi') {
            fig.layout.shapes.push({
                type: 'line',
                x0: 0,
                x1: 1,
                y0: 0.3,
                y1: 0.3,
                xref: `x${index + 1} domain`,
                yref: `y${index + 1}`,
                line: {
                    dash: 'dot',
                    color: 'black'
                }
            });
        } else if (selectedColumn === 'max_rhat') {
            fig.layout.shapes.push({
                type: 'line',
                x0: 0,
                x1: 1,
                y0: 1.01,
                y1: 1.01,
                xref: `x${index + 1} domain`,
                yref: `y${index + 1}`,
                line: {
                    dash: 'dot',
                    color: 'black'
                }
            });
        }
    });

    Plotly.newPlot('plot', fig.data, fig.layout).then(() => {
        const legendDiv = document.getElementById('legendContent');
        legendDiv.innerHTML = ''; // Clear previous legend items

        legendTraces.forEach((trace, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.style.color = trace.marker.color;
            legendItem.innerHTML = trace.name;
            legendItem.onclick = () => {
                const traceIndices = fig.data
                    .map((d, i) => (d.name === trace.name ? i : null))
                    .filter(i => i !== null);
                const currentVisibility = fig.data[traceIndices[0]].visible !== 'legendonly';
                Plotly.restyle('plot', { visible: currentVisibility ? 'legendonly' : true }, traceIndices);
                legendItem.classList.toggle('deselected', currentVisibility);
            };
            legendDiv.appendChild(legendItem);
        });
    });
}

function groupQuantiles(data, targetColumn, groupColumns, quantiles) {
    // Create a key function for grouping
    const keyFunction = d => groupColumns.map(col => d[col]).join('--');

    // Group the data
    let groupedData = d3.group(data, keyFunction);

    // Calculate the specified quantiles for each group and flatten the result
    let result = [];
    groupedData.forEach((group, key) => {
        let quantileValues = {};
        quantiles.forEach(q => {
            quantileValues[`q${q}`] = d3.quantile(group.map(d => d[targetColumn]).sort(d3.ascending), q);
        });
        let groupKeys = key.split('--').reduce((obj, val, index) => {
            obj[groupColumns[index]] = val;
            return obj;
        }, {});
        result.push({ ...groupKeys, ...quantileValues });
    });

    return result;
}

function addNormalizedByBestColumn(data, selectedColumn) {
    const groupedData = d3.group(data, d => `${d.target}--${d.target_config}--${d.chain}`);
    const bestValues = {};
    groupedData.forEach((group, key) => {
        const bestValue = selectedColumn === 'max_rhat' || selectedColumn === 'max_abs_rel_error' || selectedColumn === 'n_divergent' || selectedColumn === 'rmsre'
            ? d3.min(group, d => +d[selectedColumn])
            : d3.max(group, d => +d[selectedColumn]);
        bestValues[key] = bestValue;
    });

    const normalizedData = data.map(d => {
        const bestValue = bestValues[`${d.target}--${d.target_config}--${d.chain}`];
        return { ...d, [`${selectedColumn}_normalized`]: +d[selectedColumn] / bestValue };
    });

    return normalizedData;
}

function plotSummary2(data, selectedColumn, prob) {
    // Remove rows where the selected column is empty
    const filteredData = data.filter(row => row[selectedColumn] !== '');
    const alpha = (1 - prob) / 2;
    const quantiles = [alpha, 0.5, 1 - alpha];
    const dataQuantiles = groupQuantiles(filteredData, selectedColumn, ['target', 'target_config', 'transform'], quantiles);
    // make a new plotly line plot plotting target_config on the x-axis.
    // The y-axis for each target_config should have a partially transparent band between the first and third quantiles
    // and a line at the median quantile. The line should be colored by the transform.
    const fig = {
        data: [],
        layout: {
            title: `${selectedColumn} vs target_config`,
            showlegend: true,
            height: 600,
            margin: { l: 80, r: 20, b: 60, t: 50 },
            shapes: []
        }
    };
    // for each transform, add a line and a band. The line should be the median quantile and the band should be the first and third quantiles, with opacity 0.3
    // the lines and bands should be colored by the transform
    transformOrder.forEach(transform => {
        const transformData = dataQuantiles.filter(row => row.transform === transform);
        const trace = {
            x: transformData.map(row => row.target_config),
            y: transformData.map(row => row[`q0.5`]),
            type: 'scatter',
            mode: 'lines',
            name: transform,
            legendgroup: transform,
            line: { color: transformColors(transform) }
        };
        fig.data.push(trace);
        const band = {
            x: transformData.map(row => row.target_config).concat(transformData.map(row => row.target_config).reverse()),
            y: transformData.map(row => row[`q${alpha}`]).concat(transformData.map(row => row[`q${1 - alpha}`]).reverse()),
            mode: 'none',
            fill: 'toself',
            fillcolor: transformColors(transform),
            legendgroup: transform,
            line: { width: 0 },
            opacity: 0.3,
            showlegend: false
        };
        fig.data.push(band);
    });

    fig.layout['xaxis'] = { title: 'target_config', automargin: true, tickangle: 45 };
    fig.layout['yaxis'] = { title: selectedColumn, type: selectedColumn !== 'n_divergent' && selectedColumn !== 'bfmi' ? 'log' : 'linear', automargin: true, tickpadding: 10 };
    Plotly.newPlot('plot', fig.data, fig.layout);
}
