import React, { Component } from "react";
import Codemirror from "react-codemirror";
import "codemirror/mode/javascript/javascript";

import { shouldRender } from "../../src/common/forms/utils";
import campaignFormSchema from "../formSchema";
import Form from "../../src/common/forms";
import CopyLink from "../../src/common/forms/components/CopyLink";
import Editor from "../../src/common/forms/components/Editor";

import _ from "lodash";

// Import a few CodeMirror themes; these are used to match alternative
// bootstrap ones.
import "codemirror/lib/codemirror.css";

// Patching CodeMirror#componentWillReceiveProps so it's executed synchronously
// Ref https://github.com/mozilla-services/react-jsonschema-form/issues/174
Codemirror.prototype.componentWillReceiveProps = function(nextProps) {
  if (
    this.codeMirror &&
    nextProps.value !== undefined &&
    this.codeMirror.getValue() != nextProps.value
  ) {
    this.codeMirror.setValue(nextProps.value);
  }
  if (typeof nextProps.options === "object") {
    for (var optionName in nextProps.options) {
      if (nextProps.options.hasOwnProperty(optionName)) {
        this.codeMirror.setOption(optionName, nextProps.options[optionName]);
      }
    }
  }
};

const log = type => console.log.bind(console, type);
const fromJson = json => JSON.parse(json);
const toJson = val => JSON.stringify(val, null, 2);
const liveValidateSchema = { type: "boolean", title: "Live validation" };

export default class CampaignForm extends Component {
  constructor(props) {
    super(props);
    // initialize state with Campaign data sample
    const { schema, uiSchema, formData, validate } = campaignFormSchema;
    this.state = {
      form: false,
      schema,
      uiSchema,
      formData,
      validate,
      editor: "default",
      theme: "default",
      liveValidate: true,
      shareURL: null,
    };
  }

  componentDidMount() {
    const hash = document.location.hash.match(/#(.*)/);
    if (hash && typeof hash[1] === "string" && hash[1].length > 0) {
      try {
        this.load(JSON.parse(atob(hash[1])));
      } catch (err) {
        alert("Unable to load form setup data.");
      }
    } else {
      this.load(campaignFormSchema);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldRender(this, nextProps, nextState);
  }

  load = data => {
    // Reset the ArrayFieldTemplate whenever you load new data
    const { ArrayFieldTemplate } = data;
    // force resetting form component instance
    this.setState({ form: false }, _ =>
      this.setState({ ...data, form: true, ArrayFieldTemplate })
    );
  };

  onFormDataEdited = formData => this.setState({ formData, shareURL: null });

  getAlteredSchemaDependantOnFormData = formData => {
    let schema = this.state.schema
    if (formData.questions) {
      let questions_array = []
      let question_names_array = []
      for (var increment_question = 0; increment_question < formData.questions.length; increment_question++) {
        let question = formData.questions[increment_question]
        questions_array.push(question.name)
        question_names_array.push("Questions #" + (increment_question+1) + " - " + question.name)
      }
      if (questions_array.length > 0) {
        schema.properties.questions.items.properties.responses.items.properties.next.enum = questions_array;
        schema.properties.questions.items.properties.responses.items.properties.next.enumNames = question_names_array;
      }
    }
    return schema
  }

  onFormDataChange = ({ formData }) => {
    let schema = this.getAlteredSchemaDependantOnFormData(formData)
    this.setState({ formData, schema, shareURL: null });
  }

  questionsToJsonForApi = (questions) => {
    //debugger;
    let example = {
      "disposition": {
        "name": "What was the Overall Outcome?",
        "answers": {
          "2": {
            "value": "answering machine"
          },
          "3": {
            "value": "not interested"
          },
          "4": {
            "value": "meaningful conversation",
            "next": "loan_support"
          },
          "5": {
            "value": "can’t talk now, call back later"
          },
          "6": {
            "value": "do not call"
          },
          "7": {
            "value": "no answer"
          },
          "8": {
            "value": "wrong number"
          }
        }
      },
      "loan_support": {
        "name": "Do they support the Loan?",
        "answers": {
          "2": {
            "value": "supports the loan"
          },
          "3": {
            "value": "does not support the loan",
            "next": "prefered_spending_priority"
          },
          "4": {
            "value": "unsure about support for the loan",
            "next": "prefered_spending_priority"
          }
        }
      },
      "prefered_spending_priority": {
        "name": "What’s their prefered spending priority?",
        "answers": {
          "2": {
            "value": "healthcare",
            "next": "coalition_support"
          },
          "3": {
            "value": "education",
            "next": "coalition_support"
          },
          "4": {
            "value": "job creation",
            "next": "coalition_support"
          },
          "5": {
            "value": "local infrastructure",
            "next": "coalition_support"
          },
          "6": {
            "value": "disaster relief to rebuild infrastructure in queensland",
            "next": "coalition_support"
          },
          "7": {
            "value": "other",
            "next": "coalition_support"
          }
        }
      },
      "coalition_support": {
        "name": "Will it influence their support for the coalition?",
        "answers": {
          "2": {
            "value": "would influence their support for the coalition",
            "next": "voter_id"
          },
          "3": {
            "value": "would not influence their support for the coalition",
            "next": "voter_id"
          },
          "4": {
            "value": "may influence their support for the coalition",
            "next": "voter_id"
          },
          "5": {
            "value": "would not say",
            "next": "voter_id"
          }
        }
      },
      "voter_id": {
        "name": "Who did they vote for in the last federal election?",
        "answers": {
          "2": {
            "value": "LNP and Liberals",
            "next": "action"
          },
          "3": {
            "value": "Labour",
            "next": "action"
          },
          "4": {
            "value": "Greens",
            "next": "action"
          },
          "5": {
            "value": "Hanson",
            "next": "action"
          },
          "6": {
            "value": "Other",
            "next": "action"
          },
          "7": {
            "value": "Did not say",
            "next": "action"
          }
        }
      },
      "action": {
        "name": "What action did they agree to take?",
        "type": "SMS",
        "answers": {
          "2": {
            "value": "will call member of parliament",
            "deliver": true,
            "content": "Hi, thanks for taking action on this important issue! David Coleman’s number is 9771 3400. Ideally, call during office hours, so that your message can’t be ignored. Tell the person that you speak to that you live in the Forde electorate, your views on  the $1 billion government funding for the Adani coal mine, and that you would like to know what David Coleman’s position is on this issue."
          },
          "3": {
            "value": "may call member of parliament",
            "deliver": true,
            "content": "Hi, thanks for talking to me tonight! Remember David Coleman is your representative and should be working for you. If you’re able to give his office a quick call on 9771 3400, that would be great! Just tell the person that you speak to that you live in the Forde electorate, you are opposed to the $1 billion government funding for the Adani coal mine, and you would like to know what David Coleman’s position is on this issue."
          },
          "4": {
            "value": "will email member of parliament",
            "deliver": true,
            "content": "Hi, thanks for taking action on this important issue! David Coleman’s email is david.coleman.mp@aph.gov.au. Here’s a sample message: (Dear Mr Coleman, I live in the Forde electorate and I am opposed to the $1 billion NAIF funding for the Adani coal mine. Could you please tell me what your position on this issue is?)"
          },
          "5": {
            "value": "may email member of parliament",
            "deliver": true,
            "content": "Hi, thanks for talking to me tonight! Remember David Coleman is your representative and should be working for you. If you could send a quick email him, that would be great! His email is david.coleman.mp@aph.gov.au. Here’s a sample message: (Dear Mr Coleman, I live in the Forde electorate and I am opposed to the $1 billion NAIF funding for the Adani coal mine. Could you please tell me what your position on this issue is?)"
          },
          "6": {
            "value": "will not take action",
            "deliver": false
          }
        }
      }
    }
    return questions
  }

  moreInfoToJsonForApi = (more_info) => {
    let default_keypad_entry_stepper = 4
    let more_info_object = {}
    for (let increment_more_info = 0; increment_more_info < more_info.length; increment_more_info++) {
      let increment_more_info_string = (increment_more_info + default_keypad_entry_stepper).toString()
      Object.assign(more_info_object,
        {
          increment_more_info_string: {
            "title": more_info[increment_more_info].title,
            "content": more_info[increment_more_info].content
          }
        }
      );
    }

    let example = {
      "5": {
        "title": "The Stop Adani campaign strategy",
        "content": "Without the proposed one billion dollar handout from the federal government, it’s very unlikely that the Adani coal mine will proceed. Fortunately, this handout is very unpopular with voters. Our strategy then is to talk to voters in key Liberal-held marginal electorates where there are moderate Liberal MPs. The theory is that given enough pressure, these MPs will speak out against the loan and force the government to rethink the loan. Malcolm Turnbull can direct the Minister for Northern Australia, Matt Canavan, to veto the loan, and will do so given sufficient pressure from back bench MPs."
      },
      "6": {
        "title": "The background of the Adani Company",
        "content": "The Adani company is attempting to build one of the world’s largest coal mines in Northern Queensland. So far, they have not been able to secure any private finance for the project. However, a federal government body called the Northern Australian Infrastructure Facility (or NAIF) has indicated they that may lend Adani one billion dollars to help the company build a rail line from the mine to a port. Technically this would be a loan, but can reasonably be described as a handout because it is a very high risk venture that contradicts the criteria that money is meant to be lent on. The Adani group has 26 companies operating in Australia, of which 13 are ultimately registered in the Cayman Islands, a notorious tax haven. Currently the federal government does not know which of these companies has actually applied for the loan. NAIF is a supposedly independent body, but the seven member board is stacked with people with strong connections to with the mining industry. We are expecting the NAIF board to make a decision on the funding sometime in the middle of the year."
      },
      "7": {
        "title": "The target MP and electorate",
        "content": "David Coleman is the member for the Banks electorate. He is in the moderate faction of the Liberal Party and won the seat by 1300 votes last election. The Banks electorate is in south-west Sydney, and  includes the suburbs of Padstow, Panania, Peakhurst and Revesby. Banks was always held by Labor until David Coleman won in twenty thirteen."
      },
      "8": {
        "title": "The conversation guide",
        "content": "You should have a print out of the conversation guide for Banks in front of you. I will now talk you through the conversation guide, starting with the intro. The aim of the intro section is to get into the conversation without the person hanging up on you, so we initially ask them if they are happy to answer just one question. If they answer our question about whether they’ve heard about the government’s plan to give one billion dollars to Adani, then we proceed. If they haven’t heard about the funding, then we give them the short spiel in the red, no box, otherwise we proceed to asking them if they support the loan. If they do support the loan, then it’s time to cut our losses and wrap up the phone call. Jump down to the grey box at the bottom to quickly close the conversation. Otherwise, we proceed to ask them whether they think the government should be more consultative about its spending, and what better ways to spend one billion dollars of public money might be. Again, if the person is opposed to the idea that there are better priorities to spend public money on, it’s time to wrap up the conversation. Otherwise, try and draw out what these priorities might be - whether it’s public education, hospitals, local infrastructure, renewable energy, or something else. Next we ask the key question or whether this is an issue that would make them less likely to support the Liberals. This is designed to test whether this is a vote-shifting issue, and elicit who they voted for. If the person doesn’t tell you who tell voted for, ask them the follow up question of how they voted last election. This is very important and useful information to gather, as it enables us to work out if we are having an impact, and who we should call back again. Lastly, we want to move people to action. We generally ask them to do the high barrier action first, and then step down if they decline. In this case, the high barrier action is to call the MP. If they agree, follow the yes box. If they decline, follow the no box and ask them to email the MP. That’s it! Close the conversation by thanking them for their time. At the end of the phone call you will be prompted to input the results using the key pad on your phone. This concludes the explanation of the conversation guide. Please ask your coordinator any questions, listen to a few calls and practise with another person, until you feel comfortable with the conversation guide."
      }
    }
    debugger
    return more_info_object
  }

  toJsonForApi = (formData) => {
    formData = Object.assign({}, formData.basics, formData.numbers, formData.poll, formData.advanced_settings);
    return formData
  }

  onFormSubmit = ({ formData }) => {
    formData = this.toJsonForApi(formData)
    fetch('/campaigns', {
      method: 'post',
      headers: {
          'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify(formData)
    })
    .then(function (response) {
      return response.json();
    })
    .then(function (result) {
      console.log(result)
    })
    .catch (function (error) {
      console.log('Request failed', error);
    });
    this.setState({ formData, shareURL: null });
  }

  onShare = () => {
    const { formData, schema, uiSchema } = this.state;
    const { location: { origin, pathname } } = document;
    try {
      const hash = btoa(JSON.stringify({ formData, schema, uiSchema }));
      this.setState({ shareURL: `${origin}${pathname}#${hash}` });
    } catch (err) {
      this.setState({ shareURL: null });
    }
  };

  render() {
    const {
      schema,
      uiSchema,
      formData,
      liveValidate,
      validate,
      theme,
      editor,
      ArrayFieldTemplate,
      transformErrors,
    } = this.state;

    return (
      <div className="container-fluid">
        <div className="col-sm-12">
          {this.state.form &&
            <Form
              ArrayFieldTemplate={ArrayFieldTemplate}
              showErrorList={false}
              liveValidate={liveValidate}
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={this.onFormDataChange}
              onSubmit={this.onFormSubmit}
              validate={validate}
              onBlur={(id, value) =>
                console.log(`Touched ${id} with value ${value}`)}
              transformErrors={transformErrors}
              onError={log("errors")}>
              <div className="row">
                <div className="col-sm-3">
                  <button className="btn btn-primary" type="submit">
                    Submit
                  </button>
                </div>
                <div className="col-sm-9 text-right">
                  <CopyLink
                    shareURL={this.state.shareURL}
                    onShare={this.onShare}
                  />
                </div>
              </div>
            </Form>}
        </div>
        <div className="row">
          <div className="col-sm-12"><hr/></div>
        </div>
        <div className="row">
          <div className="col-sm-12">
            <Editor
              title="formData"
              theme={editor}
              code={toJson(formData)}
              onChange={this.onFormDataEdited}
            />
          </div>
        </div>
      </div>
    );
  }
}
