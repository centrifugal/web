import React from 'react';
import {
  Button, Form, FormGroup, Label, Input,
} from 'reactstrap';

const globalUrlPrefix = window.location.pathname;

class AddEditForm extends React.Component {
  constructor() {
    super();
    this.state = {
      id: 0,
      name: '',
      protected: false,
      anonymous: false,
      presence: false,
      presence_disable_for_client: false,
      join_leave: false,
      history_size: 0,
      history_ttl: '0s',
      history_disable_for_client: false,
      position: false,
      recover: false,
      publish: false,
      subscribe_to_publish: false,
      proxy_subscribe: false,
      proxy_publish: false,
      personal: false,
      personal_single_connection: false,
      error: '',
    };
  }

  componentDidMount() {
    // if item exists, populate the state with proper data
    if (this.props.item) {
      this.setState({
        id: this.props.item.id,
        name: this.props.item.name,
        protected: this.props.item.protected,
        anonymous: this.props.item.anonymous,
        presence: this.props.item.presence,
        presence_disable_for_client: this.props.item.presence_disable_for_client,
        join_leave: this.props.item.join_leave,
        history_size: this.props.item.history_size,
        history_ttl: this.props.item.history_ttl,
        history_disable_for_client: this.props.item.history_disable_for_client,
        position: this.props.item.position,
        recover: this.props.item.recover,
        publish: this.props.item.publish,
        subscribe_to_publish: this.props.item.subscribe_to_publish,
        proxy_subscribe: this.props.item.proxy_subscribe,
        proxy_publish: this.props.item.proxy_publish,
        personal: this.props.item.personal,
        personal_single_connection: this.props.item.personal_single_connection,
      });
    }
  }

  onChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  }

  onIntegerChange = (e) => {
    this.setState({ [e.target.name]: parseInt(e.target.value, 10) });
  }

  onCheckboxChange = (e) => {
    this.setState({ [e.target.name]: e.target.checked });
  }

  submitFormAdd = (e) => {
    e.preventDefault();
    fetch(`${globalUrlPrefix}admin/namespaces`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        name: this.state.name,
        protected: this.state.protected,
        anonymous: this.state.anonymous,
        presence: this.state.presence,
        presence_disable_for_client: this.state.presence_disable_for_client,
        join_leave: this.state.join_leave,
        history_size: this.state.history_size,
        history_ttl: this.state.history_ttl,
        history_disable_for_client: this.state.history_disable_for_client,
        position: this.state.position,
        recover: this.state.recover,
        publish: this.state.publish,
        subscribe_to_publish: this.state.subscribe_to_publish,
        proxy_subscribe: this.state.proxy_subscribe,
        proxy_publish: this.state.proxy_publish,
        personal: this.state.personal,
        personal_single_connection: this.state.personal_single_connection,
      }),
    })
      .then((response) => {
        if (response.ok) {
          return response.json().then(() => {
            this.props.updateState();
            this.props.toggle();
          });
        }
        if (response.status === 400) {
          return response.json().then((errorObj) => {
            this.setState({ error: errorObj.message });
          });
        }
        throw new Error(response.status);
      })
      .catch((err) => {
        this.setState({ error: 'Error occurred: ' + err.message });
        console.log(err);
      });
  }

  submitFormEdit = (e) => {
    e.preventDefault();
    fetch(`${globalUrlPrefix}admin/namespaces`, {
      method: 'put',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        id: this.state.id,
        name: this.state.name,
        protected: this.state.protected,
        anonymous: this.state.anonymous,
        presence: this.state.presence,
        presence_disable_for_client: this.state.presence_disable_for_client,
        join_leave: this.state.join_leave,
        history_size: this.state.history_size,
        history_ttl: this.state.history_ttl,
        history_disable_for_client: this.state.history_disable_for_client,
        position: this.state.position,
        recover: this.state.recover,
        publish: this.state.publish,
        subscribe_to_publish: this.state.subscribe_to_publish,
        proxy_subscribe: this.state.proxy_subscribe,
        proxy_publish: this.state.proxy_publish,
        personal: this.state.personal,
        personal_single_connection: this.state.personal_single_connection,
      }),
    })
      .then((response) => {
        if (response.ok) {
          return response.json().then(() => {
            this.props.updateState();
            this.props.toggle();
          });
        }
        if (response.status === 400) {
          return response.json().then((errorObj) => {
            this.setState({ error: errorObj.message });
          });
        }
        throw new Error(response.status);
      })
      .catch((err) => {
        this.setState({ error: 'Error occurred: ' + err.message });
        console.log(err);
      });
  }

  render() {
    let error;
    if (this.state.error) {
      error = <span className="box box-error">{this.state.error}</span>;
    }
    let nameFormGroup;
    if (this.props.item && this.props.item.name === '') {
      // Attempt to edit default namespace.
    } else {
      nameFormGroup = (
        <FormGroup>
          <Label for="name">Name</Label>
          <Input type="text" name="name" id="name" onChange={this.onChange} value={this.state.name === null ? '' : this.state.name} />
        </FormGroup>
      );
    }
    return (
      <Form onSubmit={this.props.item ? this.submitFormEdit : this.submitFormAdd}>
        {nameFormGroup}
        <div className="form-row">
          <FormGroup className="col-md-6">
            <Label for="history_size">History size</Label>
            <Input type="number" min="0" max="4294967295" step="1" name="history_size" id="history_size" onChange={this.onIntegerChange} value={this.state.history_size === null ? '0' : this.state.history_size} />
          </FormGroup>
          <FormGroup className="col-md-6">
            <Label for="history_ttl">History TTL</Label>
            <Input type="text" name="history_ttl" id="history_ttl" onChange={this.onChange} value={this.state.history_ttl === null ? '0s' : this.state.history_ttl} />
          </FormGroup>
        </div>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="history_disable_for_client" id="history_disable_for_client" onChange={this.onCheckboxChange} checked={this.state.history_disable_for_client} />
            {' '}
            History disable for client
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="position" id="position" onChange={this.onCheckboxChange} checked={this.state.position} />
            {' '}
            Position
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="recover" id="recover" onChange={this.onCheckboxChange} checked={this.state.recover} />
            {' '}
            Recover
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="presence" id="presence" onChange={this.onCheckboxChange} checked={this.state.presence} />
            {' '}
            Presence
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="presence_disable_for_client" id="presence_disable_for_client" onChange={this.onCheckboxChange} checked={this.state.presence_disable_for_client} />
            {' '}
            Presence disable for client
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="join_leave" id="join_leave" onChange={this.onCheckboxChange} checked={this.state.join_leave} />
            {' '}
            Join/Leave
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="protected" id="protected" onChange={this.onCheckboxChange} checked={this.state.protected} />
            {' '}
            Protected
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="anonymous" id="anonymous" onChange={this.onCheckboxChange} checked={this.state.anonymous} />
            {' '}
            Anonymous
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="publish" id="publish" onChange={this.onCheckboxChange} checked={this.state.publish} />
            {' '}
            Publish
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="subscribe_to_publish" id="subscribe_to_publish" onChange={this.onCheckboxChange} checked={this.state.subscribe_to_publish} />
            {' '}
            Subscribe to publish
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="proxy_subscribe" id="proxy_subscribe" onChange={this.onCheckboxChange} checked={this.state.proxy_subscribe} />
            {' '}
            Proxy subscribe
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="proxy_publish" id="proxy_publish" onChange={this.onCheckboxChange} checked={this.state.proxy_publish} />
            {' '}
            Proxy publish
          </Label>
        </FormGroup>
        <hr />
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="personal" id="personal" onChange={this.onCheckboxChange} checked={this.state.personal} />
            {' '}
            Mark as personal (enables auto personal subscription)
          </Label>
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" name="personal_single_connection" id="personal_single_connection" onChange={this.onCheckboxChange} checked={this.state.personal_single_connection} />
            {' '}
            Maintain single personal connection
          </Label>
        </FormGroup>
        <br />
        <Button>Submit</Button>
        {' '}
        {error}
      </Form>
    );
  }
}

export default AddEditForm;
