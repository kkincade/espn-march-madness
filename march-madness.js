// TODO:
// Take into account teams without information.

// Instructions:
// 1. Navigate to the bracket page in ESPN.
// 2. Open Chrome Dev Tools.
// 3. In Sources, select "Snippets".
// 4. Select "New Snippet" and name it (e.g. march-madness).
// 5. Copy and paste the code below into the snippet.
// 6. Right click and select "Run".


(async function () {
    
    // region Variables and Constants
    
    let numberOfUpsets = 0;

    const logging = true;
    const NumberOfMatchups = 64;

    const StatKeys = {
        ID: 'id',
        NAME: 'name',
        SEED: 'seed',
        RECORD: 'record', 
        BPI_RANK: 'BPI Rank',
        // NOTE: They removed RPI Rank for some reason.
        // RPI_RANK: 'RPI Rank',
        VS_TOP_25: 'VS Top 25',
        OPP_PPG: 'Opp. PPG',
        CONFERENCE: 'Conference',
        PPG: 'PPG',
        LAST_12_GAMES: 'Last 12 Games'
    };

    // endregion


    // region Program

    // Iterates over each matchup and selects a winner.
    for (let matchupIndex = 1; matchupIndex < NumberOfMatchups; matchupIndex++) {
        const winner = await getMatchupWinner(matchupIndex);
        await selectTeamInMatchup(matchupIndex, winner);
    }

    await inputChampionshipScore();

    if (logging) {
        console.log(`Number of Upsets: ${numberOfUpsets}`);
    }
    
    // endregion

    // region Winner Calculations

    /**
     * Determines the winner of the given matchup.
     * 
     * @param {number} matchupIndex - The index of the matchup we are determining the winner of.
     */
    async function getMatchupWinner(matchupIndex) {
        const matchupData = await getMatchupData(matchupIndex),
            [ teamOne, teamTwo ] = matchupData
            teamOneScore = getTeamScore(teamOne),
            teamTwoScore = getTeamScore(teamTwo),
            hasUpset = isUpset(teamOne, teamTwo, teamOneScore, teamTwoScore);

        if (logging) {
            console.log(`MATCHUP: ${matchupIndex}${hasUpset ? ' (UPSET)' : ''}`);
            console.log(`  ${teamOne.name} (${teamOne.seed}): ${teamOneScore}`);
            console.log(`  ${teamTwo.name} (${teamTwo.seed}): ${teamTwoScore}`);
        }

        return matchupData[ teamOneScore < teamTwoScore ? 1 : 0 ];
    }

    /**
     * Gets the two {@link TeamType} statistics for the given matchup.
     * 
     * @param {number} matchupIndex - The index of the matchup we are getting the team data for.
     */
    async function getMatchupData(matchupIndex) {
        await openMatchupPreview(matchupIndex);

        const matchupData = [
            getTeamStats(matchupIndex, 0),
            getTeamStats(matchupIndex, 1)
        ];

        await closeMatchupPreview(matchupIndex);

        return matchupData;
    }

    /**
     * Uses the stats and a random multiplier to get a team "score".
     * 
     * @param {TeamType} team - The team we are calculating a score for.
     */
    function getTeamScore(team) {
        const randomMultiplier = (Math.random() * (0.85 - 0.15) + 0.15),
            // NOTE: They removed RPI Rank for some reason.
            // totalRank = parseInt(team[StatKeys.BPI_RANK], 10) + parseInt(team[StatKeys.RPI_RANK], 10),
            bpiRank = parseInt(team[StatKeys.BPI_RANK], 10),
            seed = parseInt(team[StatKeys.SEED], 10),
            [ top25Wins, top25Losses] = getWinsAndLosses(team[StatKeys.VS_TOP_25]),
            ppgDifferential = parseInt(team[StatKeys.PPG], 10) - parseInt(team[StatKeys.OPP_PPG], 10);

        const score = (
            ((bpiRank / 200) * -10.0)
             + (16 / seed)
             + (top25Wins * 6)
             + (top25Losses * 2)
             + (ppgDifferential)
        ) * randomMultiplier;

        return score;
    }

    /**
     * Takes a record string (e.g. 27-10) and returns an array with the first number 
     * being the number of wins and the second number being the number of losses.
     *
     * @param {String} recordString
     */
    function getWinsAndLosses(recordString) {
        // Is the team's record not available?
        if (!recordString || recordString === '--') {
            recordString = '0-0';
        }

        return recordString.split('-').map(value => parseInt(value, 10));
    }

    /**
     * Gets the {@link TeamType} statistics for the given team in the given matchup.
     * 
     * @param {number} matchupIndex - The index of the matchup we are getting stastics for.
     * @param {number} teamIndex - The index of the team we are getting statistics for (i.e. team 1 or team 2).
     */
    function getTeamStats(matchupIndex, teamIndex) {
        const team = {},
            fnGetTeamSection = (selector) => getMatchupPreviewModal().querySelectorAll(selector),
            detailsElement = fnGetTeamSection('.matchupDetails .matchup .team')[teamIndex],
            statsElements = fnGetTeamSection('.teamDetails .statsList .stat');

        // Team ID.
        team['id'] = getMatchupElement(matchupIndex).querySelectorAll('.slots a.slot')[teamIndex].getAttribute('data-teamid');

        // Team details.
        [ StatKeys.SEED, StatKeys.NAME, StatKeys.RECORD ].forEach(statName => {
            team[statName] = detailsElement.querySelector(`.${statName}`).innerHTML
        });

        // Team stats.
        statsElements.forEach(statElement => {
            const statName = statElement.querySelector('.label').innerHTML,
                statValue = statElement.querySelectorAll('.value')[teamIndex].innerHTML;

            team[statName] = statValue;
        });

        return team;
    }

    // endregion

    // region Selection Methods

    /**
     * Clicks the provided team in the given matchup.
     * 
     * @param {number} matchupIndex - The index of the matchup we are selecting the winning team from.
     * @param {TeamType} team - The team chosen as the winner of the matchup.
     */
    async function selectTeamInMatchup(matchupIndex, team) {
        getMatchupElement(matchupIndex).querySelector(`.slots a[data-teamid='${team.id}']`).click();

        await wait(250);
    }

    /**
     * Opens the matchup preview modal for the given matchup.
     * 
     * @param {number} matchupIndex - The index of the matchup we are opening the preview for.
     */
    async function openMatchupPreview(matchupIndex) {
        getMatchupElement(matchupIndex).querySelector('button.matchupPreview').click();

        await wait(250);
    }

    /**
     * Closes the matchup preview modal.
     */
    async function closeMatchupPreview() {
        getMatchupPreviewModal().querySelector('.mpdialog-close').click();

        await wait(250);
    }

    // endregion

    // region Tiebreaker Score

    /**
     * Enters the tiebreaker score of the championship game.
     */
    async function inputChampionshipScore() {
        const [ winningScoreInput, losingScoreInput ] = document.querySelectorAll('.center .questions .tiebreaker .value input'),
            [ winningTeam, losingTeam ] = await getMatchupData(NumberOfMatchups - 1),
            scoreOne = getRandomizedScore(winningTeam),
            scoreTwo = getRandomizedScore(losingTeam);

        if (scoreOne === scoreTwo) {
            scoreOne + 2;
        }

        const isScoreOneBigger = scoreOne > scoreTwo;

        winningScoreInput.value = isScoreOneBigger ? scoreOne : scoreTwo;
        losingScoreInput.value = isScoreOneBigger ? scoreTwo : scoreOne;
    }

    /**
     * Uses the team's average PPG and a randomized offset (+/-8) to get a predictive score.
     * 
     * @param {TeamType} team - The team we are predicting a score for.
     */
    function getRandomizedScore(team) {
        // Random number between 1 and 8.
        let offset = Math.floor(Math.random() * 8) + 1;

        // Randomly make it negative or positive.
        offset *= Math.floor(Math.random() * 2) === 1 ? 1 : -1;

        return parseInt(team[StatKeys.PPG], 10) + offset;
    }

    // endregion

    // region DOM Getter Methods

    /**
     * Gets the matchup element for the given index.
     *
     * @param {number} matchupIndex - The index of the matchup we are getting the DOM element for.
     */
    function getMatchupElement(matchupIndex) {
        return document.querySelector(`.matchup.m_${matchupIndex}`);
    }

    /**
     * Gets the matchup preview modal element from the DOM.
     */
    function getMatchupPreviewModal() {
        return document.querySelector('.mpdialog.matchupPreview');
    }

    // endregion

    // region Helper Methods

    /**
     * A delay function so we can wait for elements to be added/removed from the DOM to grab data from.
     */
    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Determines if the outcome of the matchup was an upset.
     * 
     * @param {TeamType} teamOne - The first team in the matchup.
     * @param {TeamType} teamTwo - The second team in the matchup.
     * @param {float} teamOneScore - The first team's matchup score.
     * @param {float} teamTwoScore - THe second team's matchup score.
     * 
     * @returns {boolean}
     */
    function isUpset(teamOne, teamTwo, teamOneScore, teamTwoScore) {
        const isFirstTeamHigherSeed = parseInt(teamOne.seed, 10) < parseInt(teamTwo.seed, 10),
            isSecondTeamHigherSeed = parseInt(teamTwo.seed, 10) < parseInt(teamOne.seed, 10),
            teamOneWins = teamOneScore > teamTwoScore;

        let hasUpset = false;

        if (isFirstTeamHigherSeed && !teamOneWins) {
            hasUpset = true;
        }

        if (isSecondTeamHigherSeed && teamOneWins) {
            hasUpset = true;
        }

        if (hasUpset) {
            numberOfUpsets++;
        }

        return hasUpset;
    }

    // endregion
})();


/**
 * Represents a team in the NCAA basketball tournament.
 * 
 * @typedef {Object} TeamType
 *
 * @property {number} id - The ID for the team (i.e. a number from 1-64).
 * @property {String} name - The name of the team.
 * @property {number} seed - The team's seed within their region of the bracket.
 * @property {String} record - The team's overall record in a hyphen delimited string (i.e. 31-4).
 * @property {number} bpiRank - The BPI rank of the team.
 * @property {number} rpiRank - The RPI rank of the team.
 * @property {String} vsTop25 - The team's record against top 25 teams (i.e. 2-4).
 * @property {String} ppg - The team's average PPG scored over the season.
 * @property {String} oppPpg - The opponent's average PPG scored against the team over the season.
 * @property {String} conference - The name of the conference the team is a part of.
 * @property {String} last12Games - The team's record over their last 12 games.
 *
 * @global
 */