module.exports = {
  disposition: {
    name: "Disposition",
    answers: {
      "2": "answering machine",
      "3": "not interested",
      "4": "support the loan",
      "5": "does not support the loan",
      "6": "unsure about support for the loan",
    },
    next: answer => {
      if (answer === "does not support the loan" || answer === "unsure about support for the loan") return "voter_id";
      return "complete";
    }
  },
  voter_id: {
    name: "Voter ID",
    answers: {
      "2": "influence their vote and voted for LNP last election",
      "3": "influence their vote and voted for another party last election",
      "4": "would not influence vote",
    },
    next: () => "action"
  },
  action: {
    name: "Action",
    answers: {
      "2": "will call MP",
      "3": "would write to local paper or make FB post",
      "4": "will do both actions",
      "5": "won't take action",
    },
    next: () => "complete"
  },
};
