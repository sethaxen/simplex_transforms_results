function getDataFile(column) {
    return column === 'condition_number' ? "results/condition_numbers/all_thinned.csv" : "results/summaries/all.csv";
}
