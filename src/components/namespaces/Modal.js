import React, { Component } from 'react';
import {
  Button, Modal, ModalHeader, ModalBody,
} from 'reactstrap';
import AddEditForm from './FormAddEdit';

class ModalForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modal: false,
    };
  }

  toggle = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState((prevState) => ({
      modal: !prevState.modal,
    }));
  }

  render() {
    const closeBtn = <button type="button" className="close" onClick={this.toggle}>&times;</button>;

    const label = this.props.buttonLabel;

    let button = '';
    let title = '';

    if (label === 'Edit') {
      button = (
        <a
          href="#"
          color="warning"
          onClick={this.toggle}
          style={{ float: 'left', marginRight: '10px' }}
        >
          {label}
        </a>
      );
      title = 'Edit Namespace';
    } else {
      button = (
        <Button
          color="primary"
          onClick={this.toggle}
          style={{ float: 'left', marginRight: '10px' }}
        >
          {label}
        </Button>
      );
      title = 'Add New Namespace';
    }

    return (
      <div>
        {button}
        <Modal isOpen={this.state.modal} toggle={this.toggle} className={this.props.className}>
          <ModalHeader toggle={this.toggle} close={closeBtn}>{title}</ModalHeader>
          <ModalBody>
            <AddEditForm
              updateState={this.props.updateState}
              toggle={this.toggle}
              item={this.props.item}
            />
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default ModalForm;
