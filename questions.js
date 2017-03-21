module.exports = {
  disposition: {
    name: "Disposition",
    answers: {
      "2": "answering machine",
      "3": "no answer",
      "4": "not interested",
      "5": "not not call",
      "6": "wrong number",
      "7": "meaningful conversation",
    },
    next: answer => {
      if (answer === "meaningful conversation") return "loan_support";
      return "complete";
    }
  },
  loan_support: {
    name: "Loan Support",
    answers: {
      "2": "supports the loan",
      "3": "does not support the loan",
      "4": "unsure about support for the loan",
    },
    next: answer => {
      if (answer != "supports the loan") return "coalition_support";
      return "complete";
    }
  },
  coalition_support: {
    name: "Coalition Support",
    answers: {
      "2": "would influence their support for the coalition",
      "3": "would not influence their support for the coalition",
      "4": "may influence their support for the coalition",
      "5": "would not say",
    },
    next: () => "voter_id"
  },
  voter_id: {
    name: "Voter ID",
    answers: {
      "1": "liberal national party",
      "2": "labor",
      "3": "greens",
      "4": "hanson",
      "5": "other",
      "6": "did not say",
    },
    next: () => "action"
  },
  action: {
    name: "Action",
    answers: {
      "2": "will call member of parliment",
      "3": "would write to local paper or make facebook post",
      "4": "will not take action",
    },
    next: () => "complete"
  },
};
