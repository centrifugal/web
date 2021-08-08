// eslint-disable-next-line max-classes-per-file
import React from 'react';
import { Row, Col } from 'reactstrap';
import ModalForm from '../namespaces/Modal';
import DataTable from '../namespaces/DataTable';

const globalUrlPrefix = window.location.pathname;

function handleErrors(response) {
  if (!response.ok) throw new Error(response.status);
  return response;
}

// eslint-disable-next-line react/prefer-stateless-function
export default class NamespacesPage extends React.Component {
  constructor() {
    super();
    this.state = {
      items: [],
      error: '',
    };
  }

  componentDidMount() {
    this.getItems();
  }

  getItems = () => {
    const headers = new Headers();
    headers.append('Authorization', `token ${localStorage.getItem('token')}`);
    fetch(`${globalUrlPrefix}admin/namespaces`, {
      headers,
    })
      .then(handleErrors)
      .then((response) => response.json())
      .then((items) => this.setState({ items }))
      .catch((err) => {
        if (err.message === '404') {
          this.setState({ error: 'Database namespace configuration disabled (Centrifugo PRO only)' });
          return;
        }
        console.log(err);
      });
  }

  addItemToState = (item) => {
    this.setState((prevState) => ({
      items: [...prevState.items, item],
    }));
  }

  updateState = (item) => {
    const itemIndex = this.state.items.findIndex((data) => data.id === item.id);
    this.setState((prevState) => ({
      items: [
        // destructure all items from beginning to the indexed item
        ...prevState.items.slice(0, itemIndex),
        // add the updated item to the array
        item,
        // add the rest of the items to the array from the index after the replaced item
        ...prevState.items.slice(itemIndex + 1),
      ],
    }));
  }

  deleteItemFromState = (id) => {
    this.setState((prevState) => ({
      items: prevState.items.filter((item) => item.id !== id),
    }));
  }

  render() {
    let content;
    if (this.state.error === '') {
      content = (
        <div>
          <Row>
            <Col>
              <ModalForm buttonLabel="Add Namespace" updateState={this.getItems} />
            </Col>
          </Row>
          <br />
          <Row>
            <Col>
              <DataTable items={this.state.items} updateState={this.getItems} deleteItemFromState={this.deleteItemFromState} />
            </Col>
          </Row>
        </div>
      );
    } else {
      content = <p>{this.state.error}</p>;
    }
    return (
      <main className="p-3 animated fadeIn">
        <div className="animated fadeIn">
          <p className="lead">Database-driven namespace configuration</p>
          {content}
        </div>
      </main>
    );
  }
}

NamespacesPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
};
