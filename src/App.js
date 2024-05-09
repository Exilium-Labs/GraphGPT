import './App.css';
import Graph from "react-graph-vis";
import React, { useState } from "react";

const DEFAULT_PARAMS = {
  "model": "text-davinci-003",
  "temperature": 0.3,
  "max_tokens": 800,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}

const SELECTED_PROMPT = "STATELESS"

const options = {
  layout: {
    hierarchical: false
  },
  edges: {
    color: "#34495e"
  }
};

function App() {
  const [useAzureOpenAIApi, setChecked] = React.useState(false);
  const [apiURI, setApiURI] = React.useState('https://api.openai.com/v1/completions');

  const handleChangeApiURI = () => {
    setChecked(!useAzureOpenAIApi);
  };

  const handleApiURI = (event) => {
    setApiURI(event.target.value);
  };

  const Checkbox = ({ label, value, onChange }) => {
    return (
      <label>
        <input type="checkbox" checked={value} onChange={onChange} />
        {label}
      </label>
    );
  };

  const [graphState, setGraphState] = useState(
    {
      nodes: [],
      edges: []
    }
  );

  const clearState = () => {
    setGraphState({
      nodes: [],
      edges: []
    })
  };

  const updateGraph = (updates) => {
    // updates will be provided as a list of lists
    // each list will be of the form [ENTITY1, RELATION, ENTITY2] or [ENTITY1, COLOR]

    var current_graph = JSON.parse(JSON.stringify(graphState));

    if (updates.length === 0) {
      return;
    }

    // check type of first element in updates
    if (typeof updates[0] === "string") {
      // updates is a list of strings
      updates = [updates]
    }

    updates.forEach(update => {
      if (update.length === 3) {
        // update the current graph with a new relation
        const [entity1, relation, entity2] = update;

        // check if the nodes already exist
        var node1 = current_graph.nodes.find(node => node.id === entity1);
        var node2 = current_graph.nodes.find(node => node.id === entity2);

        if (node1 === undefined) {
          current_graph.nodes.push({ id: entity1, label: entity1, color: "#ffffff" });
        }

        if (node2 === undefined) {
          current_graph.nodes.push({ id: entity2, label: entity2, color: "#ffffff" });
        }

        // check if an edge between the two nodes already exists and if so, update the label
        var edge = current_graph.edges.find(edge => edge.from === entity1 && edge.to === entity2);
        if (edge !== undefined) {
          edge.label = relation;
          return;
        }

        current_graph.edges.push({ from: entity1, to: entity2, label: relation });

      } else if (update.length === 2 && update[1].startsWith("#")) {
        // update the current graph with a new color
        const [entity, color] = update;

        // check if the node already exists
        var node = current_graph.nodes.find(node => node.id === entity);

        if (node === undefined) {
          current_graph.nodes.push({ id: entity, label: entity, color: color });
          return;
        }

        // update the color of the node
        node.color = color;

      } else if (update.length === 2 && update[0] == "DELETE") {
        // delete the node at the given index
        const [_, index] = update;

        // check if the node already exists
        var node = current_graph.nodes.find(node => node.id === index);

        if (node === undefined) {
          return;
        }

        // delete the node
        current_graph.nodes = current_graph.nodes.filter(node => node.id !== index);

        // delete all edges that contain the node
        current_graph.edges = current_graph.edges.filter(edge => edge.from !== index && edge.to !== index);
      }
    });
    setGraphState(current_graph);
  };

  const queryStatelessPrompt = (prompt, apiKey) => {
    fetch('prompts/stateless.prompt')
      .then(response => response.text())
      .then(text => text.replace("$prompt", prompt))
      .then(prompt => {
        console.log("prompt:", prompt);

        let params = {};
        if (useAzureOpenAIApi == true) {
          // Azure OpenAI Studio API
          params = {
            messages: [
              {
                role: 'system',
                content: 'You are an AI assistant that helps people find information.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            stop: "\n",
            max_tokens: 100,
          };
        } else {
          // OpenAI ChatGPT API
          params = { ...DEFAULT_PARAMS, prompt: prompt, stop: "\n" };
        }

        let headers = {
          'Content-Type': 'application/json',
        };
        headers['api-key'] = String(apiKey);
        if (useAzureOpenAIApi == true) {
          // Azure OpenAI Studio API
          headers['api-key'] = String(apiKey);
        } else {
          // OpenAI ChatGPT API
          headers['Authorization'] = 'Bearer ' + String(apiKey);
        }

        const requestOptions = {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(params)
        };
        fetch(apiURI, requestOptions)
          .then(response => {
            console.log("response: ", response);
            if (!response.ok) {
              switch (response.status) {
                case 401: // 401: Unauthorized: API key is wrong
                  throw new Error('Please double-check your API key.');
                case 429: // 429: Too Many Requests: Need to pay
                  throw new Error('You exceeded your current quota, please check your plan and billing details.');
                default:
                  throw new Error('Something went wrong with the request, please check the Network log - response:', response, ", response.text", response.text());
              }
            }
            return response.json();
          })
          .then((response) => {
            console.log("response 1: ", response);
            const { choices } = response;
            console.log("choices 1: ", choices);

            let text = "";
            if (useAzureOpenAIApi == true) {
              // Azure OpenAI Studio API
              text = choices[0].message.content;
            } else {
              // OpenAI ChatGPT API
              text = choices[0].text;
            }
            console.log("text 1: ", text);

            const updates = JSON.parse(text);
            console.log(updates);

            updateGraph(updates);

            document.getElementsByClassName("searchBar")[0].value = "";
            document.body.style.cursor = 'default';
            document.getElementsByClassName("generateButton")[0].disabled = false;
          }).catch((error) => {
            console.log(error);
            alert(error);
          });
      })
  };

  const queryStatefulPrompt = (prompt, apiKey) => {
    fetch('prompts/stateful.prompt')
      .then(response => response.text())
      .then(text => text.replace("$prompt", prompt))
      .then(text => text.replace("$state", JSON.stringify(graphState)))
      .then(prompt => {
        console.log(prompt)

        let params = {};
        if (useAzureOpenAIApi == true) {
          // Azure OpenAI Studio API
          params = {
            messages: [
              {
                role: 'system',
                content: 'You are an AI assistant that helps people find information.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            // stop: "\n",
            max_tokens: 100,
          };
        } else {
          // OpenAI ChatGPT API
          params = { ...DEFAULT_PARAMS, prompt: prompt };
        }

        let headers = {
          'Content-Type': 'application/json',
        };
        headers['api-key'] = String(apiKey);
        if (useAzureOpenAIApi == true) {
          // Azure OpenAI Studio API
          headers['api-key'] = String(apiKey);
        } else {
          // OpenAI ChatGPT API
          headers['Authorization'] = 'Bearer ' + String(apiKey);
        }

        const requestOptions = {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(params)
        };
        fetch(apiURI, requestOptions)
          .then(response => {
            if (!response.ok) {
              switch (response.status) {
                case 401: // 401: Unauthorized: API key is wrong
                  throw new Error('Please double-check your API key.');
                case 429: // 429: Too Many Requests: Need to pay
                  throw new Error('You exceeded your current quota, please check your plan and billing details.');
                default:
                  throw new Error('Something went wrong with the request, please check the Network log');
              }
            }
            return response.json();
          })
          .then((response) => {
            console.log("response 2: ", response);
            const { choices } = response;
            console.log("choices 2: ", choices);

            let text = "";
            if (useAzureOpenAIApi == true) {
              // Azure OpenAI Studio API
              text = choices[0].message.content;
            } else {
              text = choices[0].text;
            }
            console.log("text 2: ", text);

            const new_graph = JSON.parse(text);

            setGraphState(new_graph);

            document.getElementsByClassName("searchBar")[0].value = "";
            document.body.style.cursor = 'default';
            document.getElementsByClassName("generateButton")[0].disabled = false;
          }).catch((error) => {
            console.log(error);
            alert(error);
          });
      })
  };

  const queryPrompt = (prompt, apiKey) => {
    if (SELECTED_PROMPT === "STATELESS") {
      queryStatelessPrompt(prompt, apiKey);
    } else if (SELECTED_PROMPT === "STATEFUL") {
      queryStatefulPrompt(prompt, apiKey);
    } else {
      alert("Please select a prompt");
      document.body.style.cursor = 'default';
      document.getElementsByClassName("generateButton")[0].disabled = false;
    }
  }


  const createGraph = () => {
    document.body.style.cursor = 'wait';

    //document.getElementsByClassName("generateButton")[0].disabled = true;
    const prompt = document.getElementsByClassName("searchBar")[0].value;
    const apiKey = document.getElementsByClassName("apiKeyTextField")[0].value;

    queryPrompt(prompt, apiKey);
  }


  const switchOpenAIApi = () => {
    document.body.style.cursor = 'wait';

    //document.getElementsByClassName("generateButton")[0].disabled = true;
    const prompt = document.getElementsByClassName("searchBar")[0].value;
    const apiKey = document.getElementsByClassName("apiKeyTextField")[0].value;

    queryPrompt(prompt, apiKey);
  }

  return (
    <div className='container'>
      <h1 className="headerText">GraphGPT 🔎</h1>
      <p className='subheaderText'>Build complex, directed graphs to add structure to your ideas using natural language. Understand the relationships between people, systems, and maybe solve a mystery.</p>
      <p className='opensourceText'><a href="https://github.com/varunshenoy/graphgpt">GraphGPT is open-source</a>&nbsp;🎉</p>
      <center>
        <div className='inputContainer'>
          <input className="searchBar" placeholder="Describe and update your graph..."></input>
          <input
            className="apiURI"
            value={apiURI}
            onChange={handleApiURI}
          />
          <input className="apiKeyTextField" type="password" placeholder="Enter your OpenAI API key..."></input>
          <Checkbox
            label="Use Azure OpenAI Studio API"
            value={useAzureOpenAIApi}
            onChange={handleChangeApiURI}
          />
          <hr />
          <button className="generateButton" onClick={createGraph}>Generate</button>
          <button className="clearButton" onClick={clearState}>Clear</button>
        </div>
      </center>
      <div className='graphContainer'>
        <Graph graph={graphState} options={options} style={{ height: "640px" }} />
      </div>
      <p className='footer'>Pro tip: don't take a screenshot! You can right-click and save the graph as a .png  📸</p>
    </div>
  );
}

export default App;
