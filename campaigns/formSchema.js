module.exports = {
  schema: {
    type: "object",
    properties: {
      basics: {
        type: "object",
        title: "Basics",
        description: "Basics of your calling campaign",
        required: [
          "name",
          "status",
          "script_url"
        ],
        properties: {
          name: {
            type: "string",
            title: "Name",
          },
          status: {
            type: "string",
            enum: [
              "active",
              "paused",
              "inactive",
            ],
            default: "active",
            title: "Status"
          },
          script_url: {
            type: "string",
            default: "http://tiny.cc/callpdfs",
            title: "Script URL"
          },
          teams: {
            type: "boolean",
            default: true,
            title: "Teams"
          },
          passcode: {
            type: "string",
            title: "Passcode"
          },
        }
      },
      numbers: {
        type: "object",
        title: "Numbers",
        description: "The Numbers Associated with your Campaign",
        properties: {
          phone_number: {
            type: "string",
            title: "Phone Number",
          },
          target_number: {
            type: "string",
            title: "Target Number",
          },
          redirect_number: {
            type: "string",
            title: "Redirect Number",
          },
          sms_number: {
            type: "string",
            default: "61476856759",
            title: "SMS Number"
          }
        }
      },

      poll: {
        type: "object",
        title: "Poll",
        properties: {
          questions: {
            type: "string",
            title: "Questions",
          },
          more_info: {
            type: "string",
            title: "More Info",
          },
        }
      },

      /*questions: {
        type: "array",
        title: "Survey Questions",
        minItems: 1,
        items: {
          type: "object",
          required: [
            "name",
            "type",
            "responses"
          ],
          properties: {
            name: {
              type: "string",
              title: "Name",
              description: "Your Questions Name"
            },
            type: {
              type: "string",
              title: "Type",
              enum: [
                "default",
                "sms"
              ],
              default: "default"
            },
            responses: {
              type: "array",
              title: "Polling Response",
              minItems: 1,
              items: {
                type: "object",
                required: [
                  "value"
                ],
                properties: {
                  value: {
                    type: "string",
                    title: "Name",
                    description: "A survey response"
                  },
                  deliver: {
                    type: "boolean",
                    title: "Deliver"
                  },
                  content: {
                    type: "string",
                    title: "Content",
                    description: "The content to deliver"
                  },
                  next: {
                    type: "string",
                    title: "Next Question",
                    enum: [
                      "CLICK TO UPDATE LIST"
                    ]
                  }
                }
              }
            }
          }
        }
      },

      more_info: {
        type: "array",
        title: "Campaign Information and Strategy",
        minItems: 1,
        items: {
          type: "object",
          required: [
            "title",
            "content"
          ],
          properties: {
            title: {
              type: "string",
              title: "Title",
              description: "Title of the information item"
            },
            content: {
              type: "string",
              title: "Content",
              description: "Content of the information item"
            },
          }
        }
      },*/

      advanced_settings: {
        type: "object",
        title: "Advanced Settings",
        description: "Please only change this if you know what you're doing",
        required: [
          "dialer",
          "acceptable_drop_rate",
          "max_ratio",
          "ratio_increment",
          "ratio_window",
          "recalculate_ratio_window",
          "ratio_decrease_factor",
          "ratio_decrease_factor",
          "max_call_attempts",
          "no_call_window",
          "daily_start_operation",
          "daily_stop_operation"
        ],
        properties: {
          dialer: {
            type: "string",
            title: "Dialer Type",
            enum: [
              "predictive",
              "power"
            ],
            default: "predictive"
          },
          detect_answering_machine: {
            type: "boolean",
            default: false,
            title: "Detect Answering Machine"
          },
          exhaust_callees_before_recycling: {
            type: "boolean",
            default: true,
            title: "Exhaust Callees Before Recycling"
          },
          acceptable_drop_rate: {
            type: "number",
            default: 0.02,
            title: "Acceptable Drop Rate"
          },
          max_ratio: {
            type: "number",
            default: 5.0,
            title: "Maximum Ratio"
          },
          ratio_increment: {
            type: "number",
            default: 0.20,
            title: "Ratio Increment"
          },
          ratio_window: {
            type: "integer",
            default: 300,
            title: "Ratio Window"
          },
          recalculate_ratio_window: {
            type: "integer",
            default: 30,
            title: "Recalculate Ratio Window (secs)"
          },
          ratio_decrease_factor: {
            type: "integer",
            default: 2,
            title: "Ratio Decrease Factor"
          },
          max_call_attempts: {
            type: "integer",
            default: 1,
            title: "Max Call Attempts"
          },
          no_call_window: {
            type: "integer",
            default: 240,
            title: "No Call Window (mins)"
          },
          daily_start_operation: {
            type: "string",
            format: "time",
            title: "Daily Start Operation",
            default: "09:00:00"
          },
          daily_stop_operation: {
            type: "string",
            format: "time",
            title: "Daily Stop Operation",
            default: "20:20:00"
          }
        }
      }
    },
  },
  uiSchema: {
    basics: {
      name: {
        "ui:autofocus": true,
        "ui:emptyValue": "",
      },
      status: {
      },
      script_url: {
      },
      teams: {
      },
      passcode: {
      }
    },
    numbers: {
      phone_number: {
      },
      target_number: {
      },
      redirect_number: {
      },
      sms_number: {
      }
    },
    poll: {
      questions: {
        "ui:widget": "textarea",
        "ui:options": {
          rows: 10
        }
      },
      more_info: {
        "ui:widget": "textarea",
        "ui:options": {
          rows: 10
        }
      }
    },
    /*questions: {
      items: {
        name: {
        },
        type: {
        },
        next: {
        },
        responses: {
          items: {
            value: {
            }
          }
        }
      }
    },
    more_info: {
      items: {
        name: {
        },
        content: {
          "ui:widget": "textarea",
          "ui:options": {
            rows: 3
          }
        }
      }
    },*/
    advanced_settings: {
      dialer: {
      },
      detect_answering_machine: {
      },
      exhaust_callees_before_recycling: {
      },
      acceptable_drop_rate: {
      },
      max_ratio: {
      },
      ratio_increment: {
      },
      ratio_window: {
      },
      recalculate_ratio_window: {
      },
      ratio_decrease_factor: {
      },
      max_call_attempts: {
      },
      no_call_window: {
      },
      daily_start_operation: {
      },
      daily_stop_operation: {
      }
    }
  }
};
